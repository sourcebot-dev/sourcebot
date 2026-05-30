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

async function fetchJson(url: URL, fetchFn: typeof fetch): Promise<unknown | undefined> {
    const response = await fetchFn(url, { headers: getMetadataHeaders() });

    if (!response.ok) {
        return undefined;
    }

    return response.json();
}

async function fetchMetadataByPriority<T>(
    urls: URL[],
    fetchFn: typeof fetch,
    schema: z.ZodType<T>,
): Promise<T | undefined> {
    const metadataPromises = urls.map(async (url) => {
        try {
            const json = await fetchJson(url, fetchFn);
            const metadata = schema.safeParse(json);
            return metadata.success ? metadata.data : undefined;
        } catch {
            return undefined;
        }
    });

    for (const metadataPromise of metadataPromises) {
        const metadata = await metadataPromise;
        if (metadata) {
            return metadata;
        }
    }

    return undefined;
}

async function discoverProtectedResourceMetadata(serverUrl: URL, fetchFn: typeof fetch) {
    const challengeMetadataPromise = (async () => {
        try {
            const response = await fetchFn(serverUrl, { headers: getMetadataHeaders() });
            const resourceMetadataUrl = extractResourceMetadataUrl(response);
            if (!resourceMetadataUrl) {
                return undefined;
            }

            const json = await fetchJson(resourceMetadataUrl, fetchFn);
            const metadata = protectedResourceMetadataSchema.safeParse(json);
            return metadata.success ? metadata.data : undefined;
        } catch {
            return undefined;
        }
    })();

    const wellKnownMetadata = await fetchMetadataByPriority(
        buildProtectedResourceMetadataUrls(serverUrl),
        fetchFn,
        protectedResourceMetadataSchema,
    );
    if (wellKnownMetadata) {
        return wellKnownMetadata;
    }

    return challengeMetadataPromise;
}

async function discoverAuthorizationServerMetadata(authorizationServerUrl: URL, fetchFn: typeof fetch) {
    return fetchMetadataByPriority(
        buildAuthorizationServerMetadataUrls(authorizationServerUrl),
        fetchFn,
        authorizationServerMetadataSchema,
    );
}

export async function checkMcpServerDcrSupport(serverUrl: string, fetchFn: typeof fetch = fetch): Promise<McpServerDcrSupport> {
    const parsedServerUrl = new URL(serverUrl);
    const protectedResourceMetadata = await discoverProtectedResourceMetadata(parsedServerUrl, fetchFn);
    const authorizationServerUrls = protectedResourceMetadata?.authorization_servers?.length
        ? protectedResourceMetadata.authorization_servers
        : [parsedServerUrl.toString()];

    let foundAuthorizationServerMetadata = false;
    let firstAuthorizationServerUrl: URL | undefined;
    for (const authorizationServer of authorizationServerUrls) {
        const authorizationServerUrl = new URL(authorizationServer);
        firstAuthorizationServerUrl ??= authorizationServerUrl;
        const authorizationServerMetadata = await discoverAuthorizationServerMetadata(authorizationServerUrl, fetchFn);
        if (!authorizationServerMetadata) {
            continue;
        }

        foundAuthorizationServerMetadata = true;
        if (authorizationServerMetadata.registration_endpoint) {
            return {
                supportsDcr: true,
                isKnown: true,
                authorizationServerUrl: normalizeUrlForOutput(authorizationServerUrl),
                registrationEndpoint: authorizationServerMetadata.registration_endpoint,
            };
        }
    }

    if (foundAuthorizationServerMetadata) {
        return {
            supportsDcr: false,
            isKnown: true,
            authorizationServerUrl: firstAuthorizationServerUrl
                ? normalizeUrlForOutput(firstAuthorizationServerUrl)
                : undefined,
        };
    }

    return {
        supportsDcr: true,
        isKnown: false,
        authorizationServerUrl: firstAuthorizationServerUrl
            ? normalizeUrlForOutput(firstAuthorizationServerUrl)
            : undefined,
    };
}
