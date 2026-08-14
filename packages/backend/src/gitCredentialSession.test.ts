import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, chmod, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { withGitCredentialSession } from './gitCredentialSession.js';

const temporaryPaths: string[] = [];

const runGitWithInput = async ({
    args,
    environment,
    input,
}: {
    args: string[];
    environment: NodeJS.ProcessEnv;
    input: string;
}) => {
    return new Promise<string>((resolve, reject) => {
        const child = spawn('git', args, {
            env: {
                ...process.env,
                ...environment,
                GIT_TERMINAL_PROMPT: '0',
            },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];

        child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
        child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
        child.once('error', reject);
        child.once('close', (code) => {
            if (code === 0) {
                resolve(Buffer.concat(stdout).toString('utf8'));
                return;
            }
            reject(new Error(Buffer.concat(stderr).toString('utf8')));
        });
        child.stdin.end(input);
    });
};

const getSocketPath = (environment: NodeJS.ProcessEnv) => {
    const count = Number(environment.GIT_CONFIG_COUNT);
    for (let index = 0; index < count; index++) {
        if (environment[`GIT_CONFIG_KEY_${index}`] !== 'credential.helper') {
            continue;
        }

        const helper = environment[`GIT_CONFIG_VALUE_${index}`];
        const match = helper?.match(/--socket='([^']+)'$/);
        if (match) {
            return match[1];
        }
    }
    throw new Error('Credential-cache socket was not configured');
};

const fillCredential = async ({
    environment,
    cloneUrl,
}: {
    environment: NodeJS.ProcessEnv;
    cloneUrl: string;
}) => {
    return runGitWithInput({
        args: ['credential', 'fill'],
        environment,
        input: `url=${cloneUrl}\n\n`,
    });
};

afterEach(async () => {
    await Promise.all(
        temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })),
    );
});

describe('withGitCredentialSession', () => {
    test('stores a credential in an isolated memory cache and removes the session afterward', async () => {
        const cloneUrl = 'https://example.com/org/repo.git';
        const token = `sourcebot-test-token-${randomUUID()}`;
        let sessionDirectory: string | undefined;

        const result = await withGitCredentialSession({
            cloneUrl,
            credentials: {
                username: 'test-user',
                password: token,
            },
            operation: async (environment) => {
                expect(JSON.stringify(environment)).not.toContain(token);
                expect(environment.GIT_ASKPASS).toBe('/bin/false');
                expect(environment.SSH_ASKPASS).toBe('/bin/false');
                expect(environment.GIT_TERMINAL_PROMPT).toBe('0');

                const socketPath = getSocketPath(environment);
                sessionDirectory = dirname(socketPath);
                expect((await stat(sessionDirectory)).mode & 0o777).toBe(0o700);

                const entries = await readdir(sessionDirectory, { withFileTypes: true });
                expect(entries.some((entry) => entry.isFile())).toBe(false);

                const credential = await fillCredential({ environment, cloneUrl });
                expect(credential).toContain('username=test-user');
                expect(credential).toContain(`password=${token}`);

                return 'completed';
            },
        });

        expect(result).toBe('completed');
        expect(sessionDirectory).toBeDefined();
        await expect(access(sessionDirectory!)).rejects.toThrow();
    });

    test('uses independent caches for concurrent operations', async () => {
        const cloneUrl = 'https://example.com/org/repo.git';
        const tokens = [
            `sourcebot-test-token-${randomUUID()}`,
            `sourcebot-test-token-${randomUUID()}`,
        ];
        const socketPaths: string[] = [];
        let releaseOperations!: () => void;
        const operationsReady = new Promise<void>((resolve) => {
            releaseOperations = resolve;
        });
        let operationCount = 0;

        const credentials = await Promise.all(tokens.map((token, tokenIndex) =>
            withGitCredentialSession({
                cloneUrl,
                credentials: {
                    username: `test-user-${tokenIndex}`,
                    password: token,
                },
                operation: async (environment) => {
                    socketPaths.push(getSocketPath(environment));
                    operationCount++;
                    if (operationCount === tokens.length) {
                        releaseOperations();
                    }
                    await operationsReady;
                    return fillCredential({ environment, cloneUrl });
                },
            }),
        ));

        expect(new Set(socketPaths).size).toBe(tokens.length);
        credentials.forEach((credential, tokenIndex) => {
            expect(credential).toContain(`username=test-user-${tokenIndex}`);
            expect(credential).toContain(`password=${tokens[tokenIndex]}`);
            expect(credential).not.toContain(tokens[1 - tokenIndex]);
        });
    });

    test('removes the session when the operation fails', async () => {
        const expectedError = new Error('operation failed');
        let sessionDirectory: string | undefined;

        await expect(withGitCredentialSession({
            cloneUrl: 'https://example.com/org/repo.git',
            credentials: {
                username: 'test-user',
                password: `sourcebot-test-token-${randomUUID()}`,
            },
            operation: async (environment) => {
                sessionDirectory = dirname(getSocketPath(environment));
                throw expectedError;
            },
        })).rejects.toBe(expectedError);

        expect(sessionDirectory).toBeDefined();
        await expect(access(sessionDirectory!)).rejects.toThrow();
    });

    test('does not place the credential in Git command arguments', async () => {
        const wrapperDirectory = await mkdtemp(join(tmpdir(), 'sourcebot-git-wrapper-'));
        temporaryPaths.push(wrapperDirectory);
        const wrapperPath = join(wrapperDirectory, 'git');
        const argvLogPath = join(wrapperDirectory, 'argv.log');
        // Resolve Git before changing PATH so the wrapper can delegate to it.
        const resolvedGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();

        await writeFile(wrapperPath, [
            '#!/bin/sh',
            'for argument in "$@"; do',
            '    printf "%s\\n" "$argument" >> "$SOURCEBOT_TEST_GIT_ARGV_LOG"',
            'done',
            'exec "$SOURCEBOT_TEST_REAL_GIT" "$@"',
            '',
        ].join('\n'));
        await chmod(wrapperPath, 0o700);

        const previousPath = process.env.PATH;
        const previousRealGit = process.env.SOURCEBOT_TEST_REAL_GIT;
        const previousArgvLog = process.env.SOURCEBOT_TEST_GIT_ARGV_LOG;
        process.env.PATH = `${wrapperDirectory}:${previousPath ?? ''}`;
        process.env.SOURCEBOT_TEST_REAL_GIT = resolvedGit;
        process.env.SOURCEBOT_TEST_GIT_ARGV_LOG = argvLogPath;

        const token = `sourcebot-test-token-${randomUUID()}`;
        try {
            await withGitCredentialSession({
                cloneUrl: 'https://example.com/org/repo.git',
                credentials: {
                    username: 'test-user',
                    password: token,
                },
                operation: async (environment) => {
                    await fillCredential({
                        environment,
                        cloneUrl: 'https://example.com/org/repo.git',
                    });
                },
            });
        } finally {
            if (previousPath === undefined) {
                delete process.env.PATH;
            } else {
                process.env.PATH = previousPath;
            }
            if (previousRealGit === undefined) {
                delete process.env.SOURCEBOT_TEST_REAL_GIT;
            } else {
                process.env.SOURCEBOT_TEST_REAL_GIT = previousRealGit;
            }
            if (previousArgvLog === undefined) {
                delete process.env.SOURCEBOT_TEST_GIT_ARGV_LOG;
            } else {
                process.env.SOURCEBOT_TEST_GIT_ARGV_LOG = previousArgvLog;
            }
        }

        const argvLog = await readFile(argvLogPath, 'utf8');
        expect(argvLog).not.toContain(token);
        expect(argvLog).not.toContain('Authorization: Basic');
        expect(argvLog).not.toContain('@example.com');
    });

    test('rejects clone URLs that already contain credentials', async () => {
        await expect(withGitCredentialSession({
            cloneUrl: 'https://embedded:secret@example.com/org/repo.git',
            credentials: {
                username: 'test-user',
                password: 'test-password',
            },
            operation: async () => undefined,
        })).rejects.toThrow('clone URL without embedded credentials');
    });

    test('preserves a user-configured URL when no separate credential is provided', async () => {
        const cloneUrl = 'https://embedded:secret@example.com/org/repo.git';
        await expect(withGitCredentialSession({
            cloneUrl,
            operation: async () => cloneUrl,
        })).resolves.toBe(cloneUrl);
    });
});
