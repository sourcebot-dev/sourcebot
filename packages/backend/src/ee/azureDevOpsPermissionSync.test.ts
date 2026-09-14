import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getAzureDevOpsReadableRepoIds } from './azureDevOpsPermissionSync.js';

const repoId = '278d5cd2-584d-4b63-824a-2ba458937249';
const repo = { id: 1, external_id: repoId, cloneUrl: 'https://dev.azure.com/acme/Project/_git/repo' };
const root = { path: '/', isFolder: true, gitObjectType: 'tree' };
const readable = () => Response.json({ count: 1, value: [root] });
const fetchMock = vi.fn();
const sync = (repos = [repo], signal = new AbortController().signal) =>
    getAzureDevOpsReadableRepoIds(repos, 'user-token', signal);

beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('Azure DevOps user permission checks', () => {
    test('checks code access using the user token at a fixed Cloud origin', async () => {
        fetchMock.mockResolvedValue(readable());
        expect(await sync()).toEqual([1]);
        const [url, options] = fetchMock.mock.calls[0];
        expect(url.origin).toBe('https://dev.azure.com');
        expect(url.pathname).toBe(`/acme/_apis/git/repositories/${repoId}/items`);
        expect(url.searchParams.get('scopePath')).toBe('/');
        expect(url.searchParams.get('recursionLevel')).toBe('none');
        expect(options).toMatchObject({
            headers: { Authorization: 'Bearer user-token', 'X-TFS-FedAuthRedirect': 'Suppress' },
            redirect: 'manual',
            signal: expect.any(AbortSignal),
        });
    });

    test('normalizes legacy Cloud clone URLs without sending tokens to them', async () => {
        fetchMock.mockResolvedValue(readable());
        expect(await sync([{ ...repo, cloneUrl: 'https://acme.visualstudio.com/DefaultCollection/Project/_git/repo' }])).toEqual([1]);
        expect(fetchMock.mock.calls[0][0].origin).toBe('https://dev.azure.com');
        expect(fetchMock.mock.calls[0][0].pathname).toContain('/acme/');
    });

    test.each([
        'https://dev.azure.com.attacker.test/acme/project/_git/repo',
        'https://attacker.test/acme/project/_git/repo',
        'http://dev.azure.com/acme/project/_git/repo',
        'https://dev.azure.com:444/acme/project/_git/repo',
        'https://dev.azure.com/acme%2fother/project/_git/repo',
    ])('rejects unsafe Cloud identities: %s', async (cloneUrl) => {
        await expect(sync([{ ...repo, cloneUrl }])).rejects.toThrow();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test('keeps organization identity when repositories share names', async () => {
        fetchMock.mockResolvedValueOnce(readable()).mockResolvedValueOnce(new Response(null, { status: 403 }));
        expect(await sync([repo, { ...repo, id: 2, cloneUrl: 'https://dev.azure.com/other/Project/_git/repo' }])).toEqual([1]);
        expect(fetchMock.mock.calls[1][0].pathname).toContain('/other/');
    });

    test.each([403, 404])('does not grant inaccessible repositories (HTTP %s)', async (status) => {
        fetchMock.mockResolvedValue(new Response(null, { status }));
        expect(await sync()).toEqual([]);
    });

    test('does not grant empty repositories', async () => {
        fetchMock.mockResolvedValue(Response.json({ count: 0, value: [] }));
        expect(await sync()).toEqual([]);
    });

    test.each([429, 500, 503])('rejects partial syncs on HTTP %s', async (status) => {
        fetchMock.mockResolvedValueOnce(readable()).mockResolvedValueOnce(new Response(null, { status }));
        await expect(sync([repo, { ...repo, id: 2 }])).rejects.toMatchObject({
            kind: status === 429 ? 'rate_limited' : 'upstream_unavailable',
        });
    });

    test('does not treat throttled 403 responses as revocations', async () => {
        fetchMock.mockResolvedValue(new Response(null, { status: 403, headers: { 'retry-after': '10' } }));
        await expect(sync()).rejects.toMatchObject({ kind: 'rate_limited' });
    });

    test('does not treat an organization-specific 401 as a global token rejection', async () => {
        fetchMock.mockResolvedValueOnce(readable()).mockResolvedValueOnce(new Response(null, { status: 401 }));
        expect(await sync([repo, { ...repo, id: 2, cloneUrl: 'https://dev.azure.com/other/Project/_git/repo' }])).toEqual([1]);
    });

    test('rejects credentials when every repository returns 401', async () => {
        fetchMock.mockImplementation(async () => new Response(null, { status: 401 }));
        await expect(sync([repo, { ...repo, id: 2 }])).rejects.toMatchObject({ kind: 'credential_rejected' });
    });

    test('does not publish a partial sync when an organization-specific 401 accompanies a transient error', async () => {
        fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }))
            .mockResolvedValueOnce(new Response(null, { status: 401 }));
        await expect(sync([repo, { ...repo, id: 2 }])).rejects.toMatchObject({ kind: 'upstream_unavailable' });
    });

    test.each([
        { value: [root] },
        { count: 2, value: [root] },
        { count: 1, value: [{ id: repoId, name: 'repo' }] },
    ])('rejects malformed responses instead of publishing partial access', async (body) => {
        fetchMock.mockResolvedValue(Response.json(body));
        await expect(sync()).rejects.toThrow();
    });

    test('rejects HTML sign-in responses and does not follow redirects', async () => {
        fetchMock.mockResolvedValueOnce(new Response('<html>Sign in</html>'));
        await expect(sync()).rejects.toThrow();
        fetchMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://login.microsoftonline.com/' } }));
        await expect(sync()).rejects.toThrow();
        expect(fetchMock.mock.calls.every(([, options]) => options.redirect === 'manual')).toBe(true);
    });

    test('stops checks after workload cancellation', async () => {
        const controller = new AbortController();
        controller.abort(new Error('Lock lost'));
        await expect(sync([repo], controller.signal)).rejects.toThrow('Lock lost');
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
