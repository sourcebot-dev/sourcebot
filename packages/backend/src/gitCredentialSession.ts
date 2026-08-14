import { spawn } from 'node:child_process';
import { chmod, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { GitHttpCredentials } from './types.js';

// Explicit cleanup normally ends the daemon immediately. This timeout is only
// a crash backstop and must be long enough for large clones and fetches.
const CACHE_TIMEOUT_SECONDS = 60 * 60;
const CACHE_EXIT_TIMEOUT_MS = 5_000;
const GIT_CREDENTIAL_COMMAND_TIMEOUT_MS = 30_000;
const CREDENTIAL_CACHE_DIRECTORY_PREFIX = 'sourcebot-git-credential-';

type GitCredentialSessionOptions<T> = {
    cloneUrl: string;
    credentials?: GitHttpCredentials;
    signal?: AbortSignal;
    operation: (environment: NodeJS.ProcessEnv) => Promise<T>;
};

const assertNoEmbeddedHttpCredentials = (cloneUrl: string) => {
    let url: URL;
    try {
        url = new URL(cloneUrl);
    } catch {
        return;
    }
    if (
        (url.protocol === 'http:' || url.protocol === 'https:') &&
        (url.username || url.password)
    ) {
        throw new Error('Authenticated Git operations require a clone URL without embedded credentials');
    }
};

const validateCredentialField = (name: string, value: string) => {
    if (value.includes('\n') || value.includes('\r') || value.includes('\0')) {
        throw new Error(`Git credential ${name} contains an unsupported control character`);
    }
};

const quoteCredentialHelperArgument = (value: string) => {
    return `'${value.replaceAll("'", "'\\''")}'`;
};

// @see: https://git-scm.com/docs/git-credential#IOFMT
const getCredentialDescription = (cloneUrl: string, credentials: GitHttpCredentials) => {
    const url = new URL(cloneUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Git HTTP credentials can only be used with HTTP(S) clone URLs');
    }
    assertNoEmbeddedHttpCredentials(cloneUrl);

    validateCredentialField('username', credentials.username);
    validateCredentialField('password', credentials.password);

    const path = decodeURIComponent(url.pathname).replace(/^\//, '');
    const fields = [
        `protocol=${url.protocol.slice(0, -1)}`,
        `host=${url.host}`,
        `path=${path}`,
        `username=${credentials.username}`,
        `password=${credentials.password}`,
        '',
    ];

    return `${fields.join('\n')}\n`;
};

const createCredentialEnvironment = ({
    socketPath,
    proactiveAuth,
}: {
    socketPath: string;
    proactiveAuth?: 'basic';
}): NodeJS.ProcessEnv => {
    const configEntries: [string, string][] = [
        // discard previously configured credential helpers
        ['credential.helper', ''],
        // Hold credentials in this operation's isolated in-memory cache.
        // @see: https://git-scm.com/docs/git-credential-cache
        [
            'credential.helper',
            `cache --timeout=${CACHE_TIMEOUT_SECONDS} --socket=${quoteCredentialHelperArgument(socketPath)}`,
        ],
        // Include the repository path when matching cached credentials.
        ['credential.useHttpPath', 'true'],
        // Prevent credential helpers from requesting user interaction.
        ['credential.interactive', 'false'],
    ];

    if (proactiveAuth === 'basic') {
        configEntries.push(
            // Disable credential-free negotiation so proactive authentication takes effect.
            ['http.emptyAuth', 'false'],
            // Send Basic credentials on the first request instead of waiting for a 401.
            ['http.proactiveAuth', 'basic'],
        );
    }

    return Object.fromEntries([
        // prevents Git from launching a graphical or scripted password prompt.
        ['GIT_ASKPASS', '/bin/false'],
        // prevents Git from launching a graphical or scripted password prompt for ssh auth.
        ['SSH_ASKPASS', '/bin/false'],
        // prevents Git from prompting through the terminal if the credential cache cannot provide a credential
        ['GIT_TERMINAL_PROMPT', '0'],
        ['GIT_CONFIG_COUNT', configEntries.length.toString()],
        ...configEntries.flatMap(([key, value], index) => [
            [`GIT_CONFIG_KEY_${index}`, key],
            [`GIT_CONFIG_VALUE_${index}`, value],
        ]),
    ]);
};

const runGit = async ({
    args,
    environment,
    input,
    signal,
    timeoutMs = GIT_CREDENTIAL_COMMAND_TIMEOUT_MS,
    sensitiveValues = [],
}: {
    args: string[];
    environment: NodeJS.ProcessEnv;
    input?: string;
    signal?: AbortSignal;
    timeoutMs?: number;
    sensitiveValues?: string[];
}) => {
    await new Promise<void>((resolve, reject) => {
        const child = spawn('git', args, {
            env: {
                ...process.env,
                ...environment,
                GIT_TERMINAL_PROMPT: '0',
            },
            signal,
            stdio: ['pipe', 'ignore', 'pipe'],
        });
        const stderr: Buffer[] = [];
        let settled = false;
        let timedOut = false;
        const timeout = setTimeout(() => {
            timedOut = true;
            child.kill('SIGKILL');
        }, timeoutMs);

        child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));

        const settle = (callback: () => void) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timeout);
            callback();
        };

        child.once('error', (error) => settle(() => reject(error)));
        child.once('close', (code, childSignal) => settle(() => {
            if (code === 0) {
                resolve();
                return;
            }
            const failure = timedOut
                ? `timed out after ${timeoutMs}ms`
                : childSignal
                    ? `signal ${childSignal}`
                    : `exit code ${code}`;
            const diagnostic = sensitiveValues
                .filter(Boolean)
                .reduce(
                    (value, sensitiveValue) => value.replaceAll(sensitiveValue, '[REDACTED]'),
                    Buffer.concat(stderr).toString('utf8').trim(),
                );
            reject(new Error(
                `Git credential command failed with ${failure}${diagnostic ? `: ${diagnostic}` : ''}`,
            ));
        }));

        child.stdin.on('error', () => {
            // The child process error/close handlers report the actionable failure.
        });
        child.stdin.end(input);
    });
};

/**
 * Runs one authenticated Git network operation with credentials held by an
 * isolated in-memory credential-cache daemon. The credential is sent to Git
 * only through stdin; the returned environment contains cache configuration,
 * but no secret values.
 */
export const withGitCredentialSession = async <T>({
    cloneUrl,
    credentials,
    signal,
    operation,
}: GitCredentialSessionOptions<T>): Promise<T> => {
    if (!credentials) {
        return operation({});
    }

    const credentialDescription = getCredentialDescription(cloneUrl, credentials);
    const sessionDirectory = await mkdtemp(join(tmpdir(), CREDENTIAL_CACHE_DIRECTORY_PREFIX));
    await chmod(sessionDirectory, 0o700);
    const socketPath = join(sessionDirectory, 'socket');
    const environment = createCredentialEnvironment({
        socketPath,
        proactiveAuth: credentials.proactiveAuth,
    });

    try {
        // Ask Git's credential subsystem to store the credential in this session's cache.
        // The cache helper lazily starts its daemon, and the secret enters Git only via stdin.
        // @see: https://git-scm.com/docs/git-credential
        await runGit({
            args: ['credential', 'approve'],
            environment,
            input: credentialDescription,
            signal,
            sensitiveValues: [credentials.password],
        });
        return await operation(environment);
    } finally {
        try {
            await runGit({
                args: ['credential-cache', `--socket=${socketPath}`, 'exit'],
                environment: {},
                timeoutMs: CACHE_EXIT_TIMEOUT_MS,
            });
        } catch {
            // The daemon may never have started or may already have exited.
        }
        await rm(sessionDirectory, { recursive: true, force: true });
    }
};
