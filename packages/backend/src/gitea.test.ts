import { expect, test, vi, beforeEach } from 'vitest';

const repoGet = vi.fn();

vi.mock('gitea-js', () => ({
    giteaApi: () => ({
        repos: { repoGet },
        orgs: { orgListRepos: vi.fn() },
        users: { userListRepos: vi.fn() },
    }),
}));

vi.mock('cross-fetch', () => ({ default: vi.fn() }));

vi.mock('@sourcebot/shared', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@sourcebot/shared')>()),
    getTokenFromConfig: vi.fn(async () => 'token'),
}));

import { getGiteaReposFromConfig } from './gitea';

beforeEach(() => {
    vi.clearAllMocks();
});

test('a repo whose fetch returns a null body is skipped with a warning instead of crashing', async () => {
    repoGet.mockResolvedValue({
        data: null,
        error: { message: 'Premature close', code: 'ERR_STREAM_PREMATURE_CLOSE' },
    });

    const result = await getGiteaReposFromConfig({
        type: 'gitea',
        url: 'https://gitea.example.com',
        token: { env: 'GITEA_TOKEN' },
        repos: ['org/broken-repo'],
    } as never);

    expect(result.repos).toHaveLength(0);
    expect(result.warnings.some(w => w.includes('broken-repo'))).toBe(true);
});

test('a repo with a valid body is returned', async () => {
    repoGet.mockResolvedValue({
        data: { id: 1, full_name: 'org/good-repo' },
        error: null,
    });

    const result = await getGiteaReposFromConfig({
        type: 'gitea',
        url: 'https://gitea.example.com',
        token: { env: 'GITEA_TOKEN' },
        repos: ['org/good-repo'],
    } as never);

    expect(result.repos).toHaveLength(1);
    expect(result.repos[0].full_name).toBe('org/good-repo');
});
