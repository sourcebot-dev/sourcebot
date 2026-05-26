import { describe, expect, test, vi } from 'vitest';
import { checkMcpServerDcrSupport } from './dcrDiscovery';

function jsonResponse(body: unknown) {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
    });
}

function notFoundResponse() {
    return new Response('Not found', { status: 404 });
}

function deferredResponse() {
    let resolve!: (response: Response) => void;
    const promise = new Promise<Response>((resolvePromise) => {
        resolve = resolvePromise;
    });

    return { promise, resolve };
}

describe('checkMcpServerDcrSupport', () => {
    test('returns supported when authorization server metadata advertises a registration endpoint', async () => {
        const fetchMock = vi.fn(async (input: string | URL | Request) => {
            const url = input.toString();
            if (url === 'https://mcp.example.com/.well-known/oauth-protected-resource/mcp') {
                return jsonResponse({ authorization_servers: ['https://auth.example.com'] });
            }
            if (url === 'https://auth.example.com/.well-known/oauth-authorization-server') {
                return jsonResponse({ registration_endpoint: 'https://auth.example.com/register' });
            }
            return notFoundResponse();
        }) as unknown as typeof fetch;

        await expect(checkMcpServerDcrSupport('https://mcp.example.com/mcp', fetchMock)).resolves.toEqual({
            supportsDcr: true,
            isKnown: true,
            authorizationServerUrl: 'https://auth.example.com',
            registrationEndpoint: 'https://auth.example.com/register',
        });
    });

    test('returns unsupported when authorization server metadata does not advertise a registration endpoint', async () => {
        const fetchMock = vi.fn(async (input: string | URL | Request) => {
            const url = input.toString();
            if (url === 'https://mcp.slack.com/.well-known/oauth-protected-resource') {
                return jsonResponse({ authorization_servers: ['https://mcp.slack.com'] });
            }
            if (url === 'https://mcp.slack.com/.well-known/oauth-authorization-server') {
                return jsonResponse({
                    authorization_endpoint: 'https://slack.com/oauth/v2_user/authorize',
                    token_endpoint: 'https://slack.com/api/oauth.v2.user.access',
                });
            }
            return notFoundResponse();
        }) as unknown as typeof fetch;

        await expect(checkMcpServerDcrSupport('https://mcp.slack.com/mcp', fetchMock)).resolves.toEqual({
            supportsDcr: false,
            isKnown: true,
            authorizationServerUrl: 'https://mcp.slack.com',
        });
    });

    test('falls back to the resource metadata URL from a bearer challenge', async () => {
        const fetchMock = vi.fn(async (input: string | URL | Request) => {
            const url = input.toString();
            if (url === 'https://auth.example.com/.well-known/oauth-authorization-server') {
                return jsonResponse({ registration_endpoint: 'https://auth.example.com/register' });
            }
            if (url.includes('/.well-known/')) {
                return notFoundResponse();
            }
            if (url === 'https://mcp.example.com/mcp') {
                return new Response('', {
                    status: 401,
                    headers: {
                        'www-authenticate': 'Bearer resource_metadata="https://metadata.example.com/oauth-protected-resource"',
                    },
                });
            }
            if (url === 'https://metadata.example.com/oauth-protected-resource') {
                return jsonResponse({ authorization_servers: ['https://auth.example.com'] });
            }
            return notFoundResponse();
        }) as unknown as typeof fetch;

        const result = await checkMcpServerDcrSupport('https://mcp.example.com/mcp', fetchMock);

        expect(result.supportsDcr).toBe(true);
        expect(result.isKnown).toBe(true);
    });

    test('ignores non-bearer authenticate challenges', async () => {
        const fetchMock = vi.fn(async (input: string | URL | Request) => {
            const url = input.toString();
            if (url.includes('/.well-known/')) {
                return notFoundResponse();
            }
            if (url === 'https://mcp.example.com/mcp') {
                return new Response('', {
                    status: 401,
                    headers: {
                        'www-authenticate': 'Basic realm="mcp"',
                    },
                });
            }
            return notFoundResponse();
        }) as unknown as typeof fetch;

        await expect(checkMcpServerDcrSupport('https://mcp.example.com/mcp', fetchMock)).resolves.toEqual({
            supportsDcr: true,
            isKnown: false,
            authorizationServerUrl: 'https://mcp.example.com/mcp',
        });
    });

    test('ignores malformed bearer resource metadata URLs', async () => {
        const fetchMock = vi.fn(async (input: string | URL | Request) => {
            const url = input.toString();
            if (url.includes('/.well-known/')) {
                return notFoundResponse();
            }
            if (url === 'https://mcp.example.com/mcp') {
                return new Response('', {
                    status: 401,
                    headers: {
                        'www-authenticate': 'Bearer resource_metadata="not a url"',
                    },
                });
            }
            return notFoundResponse();
        }) as unknown as typeof fetch;

        await expect(checkMcpServerDcrSupport('https://mcp.example.com/mcp', fetchMock)).resolves.toEqual({
            supportsDcr: true,
            isKnown: false,
            authorizationServerUrl: 'https://mcp.example.com/mcp',
        });
    });

    test('ignores bearer resource metadata parameters without quotes', async () => {
        const fetchMock = vi.fn(async (input: string | URL | Request) => {
            const url = input.toString();
            if (url.includes('/.well-known/')) {
                return notFoundResponse();
            }
            if (url === 'https://mcp.example.com/mcp') {
                return new Response('', {
                    status: 401,
                    headers: {
                        'www-authenticate': 'Bearer resource_metadata=https://metadata.example.com/oauth-protected-resource',
                    },
                });
            }
            return notFoundResponse();
        }) as unknown as typeof fetch;

        await expect(checkMcpServerDcrSupport('https://mcp.example.com/mcp', fetchMock)).resolves.toEqual({
            supportsDcr: true,
            isKnown: false,
            authorizationServerUrl: 'https://mcp.example.com/mcp',
        });
    });

    test('starts authorization server metadata candidate requests concurrently while preserving priority', async () => {
        const pathScopedOAuthMetadata = deferredResponse();
        const rootOAuthMetadata = deferredResponse();
        const pathScopedOidcMetadata = deferredResponse();
        const nestedOidcMetadata = deferredResponse();
        const fetchMock = vi.fn(async (input: string | URL | Request) => {
            const url = input.toString();
            if (url === 'https://mcp.example.com/.well-known/oauth-protected-resource/mcp') {
                return jsonResponse({ authorization_servers: ['https://auth.example.com/tenant'] });
            }
            if (url === 'https://auth.example.com/.well-known/oauth-authorization-server/tenant') {
                return pathScopedOAuthMetadata.promise;
            }
            if (url === 'https://auth.example.com/.well-known/oauth-authorization-server') {
                return rootOAuthMetadata.promise;
            }
            if (url === 'https://auth.example.com/.well-known/openid-configuration/tenant') {
                return pathScopedOidcMetadata.promise;
            }
            if (url === 'https://auth.example.com/tenant/.well-known/openid-configuration') {
                return nestedOidcMetadata.promise;
            }
            return notFoundResponse();
        }) as unknown as typeof fetch;

        const resultPromise = checkMcpServerDcrSupport('https://mcp.example.com/mcp', fetchMock);
        await vi.waitFor(() => {
            const requestedUrls = fetchMock.mock.calls.map(([input]) => input.toString());

            expect(requestedUrls).toContain('https://auth.example.com/.well-known/oauth-authorization-server/tenant');
            expect(requestedUrls).toContain('https://auth.example.com/.well-known/oauth-authorization-server');
            expect(requestedUrls).toContain('https://auth.example.com/.well-known/openid-configuration/tenant');
            expect(requestedUrls).toContain('https://auth.example.com/tenant/.well-known/openid-configuration');
        });

        rootOAuthMetadata.resolve(jsonResponse({ registration_endpoint: 'https://auth.example.com/register' }));
        pathScopedOidcMetadata.resolve(notFoundResponse());
        nestedOidcMetadata.resolve(notFoundResponse());
        await Promise.resolve();

        pathScopedOAuthMetadata.resolve(notFoundResponse());

        await expect(resultPromise).resolves.toEqual({
            supportsDcr: true,
            isKnown: true,
            authorizationServerUrl: 'https://auth.example.com/tenant',
            registrationEndpoint: 'https://auth.example.com/register',
        });
    });
});
