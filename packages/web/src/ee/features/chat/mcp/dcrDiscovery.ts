import { z } from 'zod';

const MCP_PROTOCOL_VERSION = '2025-11-25';

const protectedResourceMetadataSchema = z.object({
    authorization_servers: z.array(z.string().url()).optional(),
}).passthrough();

const authorizationServerMetadataSchema = z.object({
    registration_endpoint: z.string().url().optional(),
}).passthrough();

export interface McpServerDcrSupport {
    supportsDcr: boolean;
    isKnown: boolean;
    authorizationServerUrl?: string;
    registrationEndpoint?: string;
}

export type McpProbeFailureReason =
    | 'unreachable'
    | 'not_compatible';

export interface McpProbeSuccess {
    success: true;
    dcrSupport: McpServerDcrSupport;
}

export interface McpProbeFailure {
    success: false;
    reason: McpProbeFailureReason;
}

export type McpProbeResult = McpProbeSuccess | McpProbeFailure;

function getMetadataHeaders() {
    return {
        Accept: 'application/json',
        'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
    };
}

function buildProtectedResourceMetadataUrls(serverUrl: URL): URL[] {
    const urls: URL[] = [];
    const pathname = serverUrl.pathname.endsWith('/')
        ? serverUrl.pathname.slice(0, -1)
        : serverUrl.pathname;

    if (pathname && pathname !== '/') {
        urls.push(new URL(`/.well-known/oauth-protected-resource${pathname}`, serverUrl.origin));
    }

    urls.push(new URL('/.well-known/oauth-protected-resource', serverUrl.origin));
    return urls;
}

function buildAuthorizationServerMetadataUrls(authorizationServerUrl: URL): URL[] {
    const hasPath = authorizationServerUrl.pathname !== '/';

    if (!hasPath) {
        return [
            new URL('/.well-known/oauth-authorization-server', authorizationServerUrl.origin),
            new URL('/.well-known/openid-configuration', authorizationServerUrl.origin),
        ];
    }

    const pathname = authorizationServerUrl.pathname.endsWith('/')
        ? authorizationServerUrl.pathname.slice(0, -1)
        : authorizationServerUrl.pathname;

    return [
        new URL(`/.well-known/oauth-authorization-server${pathname}`, authorizationServerUrl.origin),
        new URL('/.well-known/oauth-authorization-server', authorizationServerUrl.origin),
        new URL(`/.well-known/openid-configuration${pathname}`, authorizationServerUrl.origin),
        new URL(`${pathname}/.well-known/openid-configuration`, authorizationServerUrl.origin),
    ];
}

function normalizeUrlForOutput(url: URL): string {
    return url.toString().replace(/\/$/, '');
}

function extractResourceMetadataUrl(response: Response): URL | undefined {
    const header = response.headers.get('www-authenticate');
    if (!header) {
        return undefined;
    }

    if (!header.toLowerCase().startsWith('bearer ')) {
        return undefined;
    }

    const match = header.match(/resource_metadata="([^"]+)"/);
    if (!match) {
        return undefined;
    }

    try {
        return new URL(match[1]);
    } catch {
        return undefined;
    }
}

interface FetchJsonResult {
    data?: unknown;
    wasReachable: boolean;
}

async function fetchJson(url: URL, fetchFn: typeof fetch): Promise<FetchJsonResult> {
    try {
        const response = await fetchFn(url, { headers: getMetadataHeaders() });

        if (!response.ok) {
            return { wasReachable: true };
        }

        return { data: await response.json(), wasReachable: true };
    } catch (error) {
        if (isNetworkError(error)) {
            return { wasReachable: false };
        }
        return { wasReachable: true };
    }
}

function isNetworkError(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return false;
    }

    const networkErrorCodes = [
        'ENOTFOUND',
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
        'ENETUNREACH',
        'EHOSTUNREACH',
        'EAI_AGAIN',
        'ERR_NAME_NOT_RESOLVED',
    ];

    const cause = (error as { cause?: { code?: string } }).cause;
    if (cause?.code && networkErrorCodes.includes(cause.code)) {
        return true;
    }

    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        return true;
    }

    return false;
}

interface FetchMetadataResult<T> {
    metadata?: T;
    anyReachable: boolean;
}

async function fetchMetadataByPriority<T>(
    urls: URL[],
    fetchFn: typeof fetch,
    schema: z.ZodType<T>,
): Promise<FetchMetadataResult<T>> {
    const metadataPromises = urls.map(async (url) => {
        const result = await fetchJson(url, fetchFn);
        if (result.data) {
            const metadata = schema.safeParse(result.data);
            return {
                metadata: metadata.success ? metadata.data : undefined,
                wasReachable: result.wasReachable,
            };
        }
        return { metadata: undefined, wasReachable: result.wasReachable };
    });

    let anyReachable = false;

    for (const metadataPromise of metadataPromises) {
        const result = await metadataPromise;
        if (result.wasReachable) {
            anyReachable = true;
        }
        if (result.metadata) {
            return { metadata: result.metadata, anyReachable: true };
        }
    }

    return { metadata: undefined, anyReachable };
}

interface DiscoverProtectedResourceResult {
    metadata?: z.infer<typeof protectedResourceMetadataSchema>;
    anyReachable: boolean;
}

async function discoverProtectedResourceMetadata(serverUrl: URL, fetchFn: typeof fetch): Promise<DiscoverProtectedResourceResult> {
    const challengeMetadataPromise = (async (): Promise<DiscoverProtectedResourceResult> => {
        try {
            const response = await fetchFn(serverUrl, { headers: getMetadataHeaders() });
            const resourceMetadataUrl = extractResourceMetadataUrl(response);
            if (!resourceMetadataUrl) {
                return { anyReachable: true };
            }

            const result = await fetchJson(resourceMetadataUrl, fetchFn);
            if (result.data) {
                const metadata = protectedResourceMetadataSchema.safeParse(result.data);
                return {
                    metadata: metadata.success ? metadata.data : undefined,
                    anyReachable: true,
                };
            }
            return { anyReachable: result.wasReachable };
        } catch (error) {
            return { anyReachable: !isNetworkError(error) };
        }
    })();

    const wellKnownResult = await fetchMetadataByPriority(
        buildProtectedResourceMetadataUrls(serverUrl),
        fetchFn,
        protectedResourceMetadataSchema,
    );
    if (wellKnownResult.metadata) {
        return wellKnownResult;
    }

    const challengeResult = await challengeMetadataPromise;
    return {
        metadata: challengeResult.metadata,
        anyReachable: wellKnownResult.anyReachable || challengeResult.anyReachable,
    };
}

async function discoverAuthorizationServerMetadata(authorizationServerUrl: URL, fetchFn: typeof fetch): Promise<FetchMetadataResult<z.infer<typeof authorizationServerMetadataSchema>>> {
    return fetchMetadataByPriority(
        buildAuthorizationServerMetadataUrls(authorizationServerUrl),
        fetchFn,
        authorizationServerMetadataSchema,
    );
}

interface DcrSupportResult {
    dcrSupport: McpServerDcrSupport;
    anyReachable: boolean;
}

async function checkMcpServerDcrSupportInternal(serverUrl: string, fetchFn: typeof fetch = fetch): Promise<DcrSupportResult> {
    const parsedServerUrl = new URL(serverUrl);
    const protectedResourceResult = await discoverProtectedResourceMetadata(parsedServerUrl, fetchFn);
    const authorizationServerUrls = protectedResourceResult.metadata?.authorization_servers?.length
        ? protectedResourceResult.metadata.authorization_servers
        : [parsedServerUrl.toString()];

    let foundAuthorizationServerMetadata = false;
    let anyAuthServerReachable = false;
    let firstAuthorizationServerUrl: URL | undefined;
    for (const authorizationServer of authorizationServerUrls) {
        const authorizationServerUrl = new URL(authorizationServer);
        firstAuthorizationServerUrl ??= authorizationServerUrl;
        const authServerResult = await discoverAuthorizationServerMetadata(authorizationServerUrl, fetchFn);
        if (authServerResult.anyReachable) {
            anyAuthServerReachable = true;
        }
        if (!authServerResult.metadata) {
            continue;
        }

        foundAuthorizationServerMetadata = true;
        if (authServerResult.metadata.registration_endpoint) {
            return {
                dcrSupport: {
                    supportsDcr: true,
                    isKnown: true,
                    authorizationServerUrl: normalizeUrlForOutput(authorizationServerUrl),
                    registrationEndpoint: authServerResult.metadata.registration_endpoint,
                },
                anyReachable: true,
            };
        }
    }

    const anyReachable = protectedResourceResult.anyReachable || anyAuthServerReachable;

    if (foundAuthorizationServerMetadata) {
        return {
            dcrSupport: {
                supportsDcr: false,
                isKnown: true,
                authorizationServerUrl: firstAuthorizationServerUrl
                    ? normalizeUrlForOutput(firstAuthorizationServerUrl)
                    : undefined,
            },
            anyReachable,
        };
    }

    return {
        dcrSupport: {
            supportsDcr: true,
            isKnown: false,
            authorizationServerUrl: firstAuthorizationServerUrl
                ? normalizeUrlForOutput(firstAuthorizationServerUrl)
                : undefined,
        },
        anyReachable,
    };
}

export async function checkMcpServerDcrSupport(serverUrl: string, fetchFn: typeof fetch = fetch): Promise<McpServerDcrSupport> {
    const result = await checkMcpServerDcrSupportInternal(serverUrl, fetchFn);
    return result.dcrSupport;
}

export async function probeMcpServerCompatibility(serverUrl: string, fetchFn: typeof fetch = fetch): Promise<McpProbeResult> {
    const result = await checkMcpServerDcrSupportInternal(serverUrl, fetchFn);

    if (!result.anyReachable) {
        return { success: false, reason: 'unreachable' };
    }

    if (!result.dcrSupport.isKnown) {
        return { success: false, reason: 'not_compatible' };
    }

    return { success: true, dcrSupport: result.dcrSupport };
}
