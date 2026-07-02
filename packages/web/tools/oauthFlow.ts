import { createHash, randomBytes } from 'crypto';
import { createServer, type ServerResponse } from 'http';
import { spawn } from 'child_process';

type Options = {
    baseUrl: string;
    scopes: string[];
    resource: string | null;
    callbackHost: string;
    callbackPort: number;
    clientId?: string;
    clientName: string;
    openBrowser: boolean;
    timeoutMs: number;
    tokenOnly: boolean;
};

type TokenResponse = {
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
    [key: string]: unknown;
};

const DEFAULT_BASE_URL = process.env.AUTH_URL || 'http://localhost:3000';
const DEFAULT_CALLBACK_HOST = '127.0.0.1';
const DEFAULT_CALLBACK_PORT = 53682;
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

function usage(): string {
    return [
        'Usage: yarn workspace @sourcebot/web tool:oauth-flow [options]',
        '',
        'Options:',
        `  --base-url <url>       Sourcebot URL. Defaults to AUTH_URL or ${DEFAULT_BASE_URL}`,
        '  --scope <scope>        OAuth scope to request. Can be repeated.',
        '  --scopes <scopes>      Space-delimited OAuth scopes to request.',
        '  --resource <url>       Resource parameter. Defaults to <base-url>/api/mcp.',
        '  --no-resource          Do not send a resource parameter.',
        `  --callback-host <host> Callback host. Defaults to ${DEFAULT_CALLBACK_HOST}.`,
        `  --port <port>          Callback port. Defaults to ${DEFAULT_CALLBACK_PORT}. Use 0 for random.`,
        '  --client-id <id>       Use an existing OAuth client instead of dynamic registration.',
        '  --client-name <name>   Dynamic client name. Defaults to "Sourcebot OAuth CLI".',
        '  --no-open             Print the authorization URL without opening a browser.',
        '  --timeout-ms <ms>      Callback wait timeout.',
        '  --token-only          Print only the access token.',
        '  --help                Show this help text.',
        '',
        'Examples:',
        '  yarn workspace @sourcebot/web tool:oauth-flow --scope mcp:read',
        '  yarn workspace @sourcebot/web tool:oauth-flow --scopes "mcp:read mcp:ask" --token-only',
        '  yarn workspace @sourcebot/web tool:oauth-flow --base-url http://localhost:3000 --no-open',
    ].join('\n');
}

function parseArgs(argv: string[]): Options {
    const options: Options = {
        baseUrl: stripTrailingSlash(DEFAULT_BASE_URL),
        scopes: [],
        resource: 'default',
        callbackHost: DEFAULT_CALLBACK_HOST,
        callbackPort: DEFAULT_CALLBACK_PORT,
        clientName: 'Sourcebot OAuth CLI',
        openBrowser: true,
        timeoutMs: DEFAULT_TIMEOUT_MS,
        tokenOnly: false,
    } as Options;

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const next = () => {
            const value = argv[++i];
            if (!value) {
                throw new Error(`Missing value for ${arg}`);
            }
            return value;
        };

        switch (arg) {
            case '--base-url':
                options.baseUrl = stripTrailingSlash(next());
                break;
            case '--scope':
                options.scopes.push(next());
                break;
            case '--scopes':
                options.scopes.push(...splitScopes(next()));
                break;
            case '--resource':
                options.resource = next();
                break;
            case '--no-resource':
                options.resource = null;
                break;
            case '--callback-host':
                options.callbackHost = next();
                break;
            case '--port':
                options.callbackPort = parseInteger(next(), '--port');
                break;
            case '--client-id':
                options.clientId = next();
                break;
            case '--client-name':
                options.clientName = next();
                break;
            case '--no-open':
                options.openBrowser = false;
                break;
            case '--timeout-ms':
                options.timeoutMs = parseInteger(next(), '--timeout-ms');
                break;
            case '--token-only':
                options.tokenOnly = true;
                break;
            case '--help':
            case '-h':
                console.log(usage());
                process.exit(0);
            default:
                throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
        }
    }

    options.scopes = [...new Set(options.scopes.map((scope) => scope.trim()).filter(Boolean))];
    if (options.resource === 'default') {
        options.resource = `${options.baseUrl}/api/mcp`;
    }

    return options;
}

function splitScopes(value: string): string[] {
    return value.split(/\s+/).map((scope) => scope.trim()).filter(Boolean);
}

function parseInteger(value: string, flag: string): number {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`${flag} must be a non-negative integer.`);
    }
    return parsed;
}

function stripTrailingSlash(value: string): string {
    return value.replace(/\/$/, '');
}

function base64UrlSha256(value: string): string {
    return createHash('sha256').update(value).digest('base64url');
}

function randomUrlSafeString(bytes = 32): string {
    return randomBytes(bytes).toString('base64url');
}

async function registerClient({
    baseUrl,
    clientName,
    redirectUri,
}: {
    baseUrl: string;
    clientName: string;
    redirectUri: string;
}): Promise<string> {
    const response = await fetch(`${baseUrl}/api/ee/oauth/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            client_name: clientName,
            redirect_uris: [redirectUri],
        }),
    });

    const body = await readJson(response);
    if (!response.ok) {
        throw new Error(`Dynamic client registration failed (${response.status}): ${JSON.stringify(body)}`);
    }

    const clientId = body.client_id;
    if (typeof clientId !== 'string') {
        throw new Error(`Dynamic client registration response did not include client_id: ${JSON.stringify(body)}`);
    }

    return clientId;
}

function startCallbackServer({
    host,
    port,
    expectedState,
    timeoutMs,
}: {
    host: string;
    port: number;
    expectedState: string;
    timeoutMs: number;
}): Promise<{ redirectUri: string; codePromise: Promise<string>; close: () => Promise<void> }> {
    let settled = false;
    let resolveCode: (code: string) => void;
    let rejectCode: (error: Error) => void;
    const codePromise = new Promise<string>((resolve, reject) => {
        resolveCode = resolve;
        rejectCode = reject;
    });

    const settleSuccess = (code: string, response: ServerResponse) => {
        if (settled) {
            return;
        }
        settled = true;
        clearTimeout(timeout);
        resolveCode(code);
        writeHtml(response, 200, 'Authorization complete. You can close this tab and return to the terminal.');
    };

    const settleError = (error: Error, response?: ServerResponse) => {
        if (settled) {
            return;
        }
        settled = true;
        clearTimeout(timeout);
        rejectCode(error);
        if (response) {
            writeHtml(response, 400, 'Authorization failed. You can close this tab and return to the terminal.');
        }
    };

    const server = createServer((request, response) => {
        const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? `${host}:${port}`}`);
        if (requestUrl.pathname !== '/callback') {
            response.writeHead(404, { 'Content-Type': 'text/plain' });
            response.end('Not found');
            return;
        }

        const error = requestUrl.searchParams.get('error');
        const errorDescription = requestUrl.searchParams.get('error_description');
        if (error) {
            const message = errorDescription ? `${error}: ${errorDescription}` : error;
            settleError(new Error(`Authorization failed: ${message}`), response);
            return;
        }

        const state = requestUrl.searchParams.get('state');
        if (state !== expectedState) {
            settleError(new Error('Authorization callback state did not match.'), response);
            return;
        }

        const code = requestUrl.searchParams.get('code');
        if (!code) {
            settleError(new Error('Authorization callback did not include a code.'), response);
            return;
        }

        settleSuccess(code, response);
    });

    const timeout = setTimeout(() => {
        settleError(new Error(`Timed out after ${timeoutMs}ms waiting for OAuth callback.`));
        void closeServer(server);
    }, timeoutMs);

    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
            server.off('error', reject);
            const address = server.address();
            const actualPort = typeof address === 'object' && address ? address.port : port;
            resolve({
                redirectUri: `http://${host}:${actualPort}/callback`,
                codePromise: codePromise.finally(() => closeServer(server)),
                close: () => closeServer(server),
            });
        });
    });
}

function writeHtml(response: ServerResponse, status: number, message: string): void {
    response.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(`<!doctype html><title>Sourcebot OAuth</title><p>${escapeHtml(message)}</p>`);
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function exchangeCode({
    baseUrl,
    clientId,
    redirectUri,
    code,
    codeVerifier,
    resource,
}: {
    baseUrl: string;
    clientId: string;
    redirectUri: string;
    code: string;
    codeVerifier: string;
    resource: string | null;
}): Promise<TokenResponse> {
    const formData = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: redirectUri,
        code,
        code_verifier: codeVerifier,
    });

    if (resource) {
        formData.set('resource', resource);
    }

    const response = await fetch(`${baseUrl}/api/ee/oauth/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
    });

    const body = await readJson(response) as TokenResponse;
    if (!response.ok) {
        throw new Error(`Token exchange failed (${response.status}): ${JSON.stringify(body)}`);
    }

    return body;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
    const text = await response.text();
    if (!text) {
        return {};
    }

    try {
        return JSON.parse(text) as Record<string, unknown>;
    } catch {
        throw new Error(`Expected JSON response from ${response.url}, got: ${text}`);
    }
}

function buildAuthorizeUrl({
    baseUrl,
    clientId,
    redirectUri,
    codeChallenge,
    state,
    scopes,
    resource,
}: {
    baseUrl: string;
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    state: string;
    scopes: string[];
    resource: string | null;
}): string {
    const authorizeUrl = new URL(`${baseUrl}/oauth/authorize`);
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('code_challenge', codeChallenge);
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');
    authorizeUrl.searchParams.set('state', state);

    if (scopes.length > 0) {
        authorizeUrl.searchParams.set('scope', scopes.join(' '));
    }

    if (resource) {
        authorizeUrl.searchParams.set('resource', resource);
    }

    return authorizeUrl.toString();
}

function openBrowser(url: string): void {
    const command = process.platform === 'darwin'
        ? 'open'
        : process.platform === 'win32'
            ? 'cmd'
            : 'xdg-open';
    const args = process.platform === 'win32'
        ? ['/c', 'start', '', url]
        : [url];

    const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
    });
    child.unref();
}

async function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
    if (!server.listening) {
        return;
    }

    await new Promise<void>((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}

async function main(): Promise<void> {
    const options = parseArgs(process.argv.slice(2));
    const state = randomUrlSafeString(24);
    const codeVerifier = randomUrlSafeString(32);
    const codeChallenge = base64UrlSha256(codeVerifier);

    const callbackServer = await startCallbackServer({
        host: options.callbackHost,
        port: options.callbackPort,
        expectedState: state,
        timeoutMs: options.timeoutMs,
    });

    try {
        const clientId = options.clientId ?? await registerClient({
            baseUrl: options.baseUrl,
            clientName: options.clientName,
            redirectUri: callbackServer.redirectUri,
        });

        const authorizeUrl = buildAuthorizeUrl({
            baseUrl: options.baseUrl,
            clientId,
            redirectUri: callbackServer.redirectUri,
            codeChallenge,
            state,
            scopes: options.scopes,
            resource: options.resource,
        });

        console.error(`Registered client: ${clientId}`);
        console.error(`Redirect URI: ${callbackServer.redirectUri}`);
        console.error(`Scopes: ${options.scopes.length > 0 ? options.scopes.join(' ') : '(none requested)'}`);
        console.error(`Resource: ${options.resource ?? '(none requested)'}`);
        console.error(`Authorization URL:\n${authorizeUrl}\n`);

        if (options.openBrowser) {
            openBrowser(authorizeUrl);
            console.error('Opened authorization URL in your browser.');
        }

        console.error('Waiting for OAuth callback...');
        const code = await callbackServer.codePromise;
        console.error('Received authorization code. Exchanging for token...');

        const tokenResponse = await exchangeCode({
            baseUrl: options.baseUrl,
            clientId,
            redirectUri: callbackServer.redirectUri,
            code,
            codeVerifier,
            resource: options.resource,
        });

        if (options.tokenOnly) {
            if (!tokenResponse.access_token) {
                throw new Error(`Token response did not include access_token: ${JSON.stringify(tokenResponse)}`);
            }
            console.log(tokenResponse.access_token);
            return;
        }

        console.log(JSON.stringify(tokenResponse, null, 2));
    } finally {
        await callbackServer.close();
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
