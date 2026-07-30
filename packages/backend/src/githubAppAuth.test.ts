import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    appsConfigured: vi.fn(),
    ensureInitialized: vi.fn(),
    getInstallationToken: vi.fn(),
    hasEntitlement: vi.fn(),
    logger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
    GithubAppInstallationNotFoundError: class GithubAppInstallationNotFoundError extends Error {
        constructor(owner: string, deploymentHostname: string) {
            super(`GitHub App installation not found for ${deploymentHostname}/${owner}`);
            this.name = 'GithubAppInstallationNotFoundError';
        }
    },
    octokitOptions: [] as Array<{ auth?: string, baseUrl?: string }>,
}));

vi.mock('@octokit/rest', () => ({
    Octokit: class {
        constructor(options: { auth?: string, baseUrl?: string }) {
            mocks.octokitOptions.push(options);
        }

        public paginate = {
            iterator: async function* (_request: unknown, options: { org: string }) {
                yield {
                    data: [{
                        clone_url: `https://github.com/${options.org}/repo.git`,
                        full_name: `${options.org}/repo`,
                        id: 1,
                        name: 'repo',
                        owner: {
                            avatar_url: '',
                            login: options.org,
                        },
                    }],
                };
            },
        };

        public repos = {
            listForOrg: vi.fn(),
        };

        public rest = {
            users: {
                getAuthenticated: vi.fn(),
            },
        };
    },
}));

vi.mock('@sentry/node', () => ({
    captureException: vi.fn(),
}));

vi.mock('@sourcebot/shared', () => ({
    createLogger: vi.fn(() => mocks.logger),
    env: {
        FALLBACK_GITHUB_CLOUD_TOKEN: undefined,
    },
    getTokenFromConfig: vi.fn(),
}));

vi.mock('./entitlements.js', () => ({
    hasEntitlement: mocks.hasEntitlement,
}));

vi.mock('./ee/githubAppManager.js', () => ({
    GithubAppInstallationNotFoundError: mocks.GithubAppInstallationNotFoundError,
    GithubAppManager: {
        getInstance: () => ({
            appsConfigured: mocks.appsConfigured,
            ensureInitialized: mocks.ensureInitialized,
            getInstallationToken: mocks.getInstallationToken,
        }),
    },
}));

import { createOctokit, getGitHubReposFromConfig } from './github.js';

describe('createOctokit', () => {
    beforeEach(() => {
        mocks.appsConfigured.mockReset().mockReturnValue(true);
        mocks.ensureInitialized.mockReset().mockResolvedValue(undefined);
        mocks.getInstallationToken.mockReset().mockResolvedValue('installation-token');
        mocks.hasEntitlement.mockReset();
        mocks.logger.debug.mockReset();
        mocks.logger.error.mockReset();
        mocks.logger.info.mockReset();
        mocks.logger.warn.mockReset();
        mocks.octokitOptions.length = 0;
    });

    test('fails safely, then uses the GitHub App when the entitlement appears after startup', async () => {
        mocks.hasEntitlement
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true);

        await expect(createOctokit({
            token: 'legacy-token',
            owner: 'example',
            context: 'org example',
        })).rejects.toThrow('GitHub App authentication is not currently licensed for org example.');

        const result = await createOctokit({
            token: 'legacy-token',
            owner: 'example',
            context: 'org example',
        });

        expect(mocks.ensureInitialized).toHaveBeenCalledTimes(2);
        expect(mocks.getInstallationToken).toHaveBeenCalledWith('example', 'github.com');
        expect(result.isAuthenticated).toBe(true);
        expect(mocks.octokitOptions).toEqual([{
            auth: 'installation-token',
        }]);
    });

    test('falls back to token authentication when no GitHub App is configured', async () => {
        mocks.appsConfigured.mockReturnValue(false);
        mocks.hasEntitlement.mockResolvedValue(false);

        const result = await createOctokit({
            token: 'legacy-token',
            owner: 'example',
            context: 'org example',
        });

        expect(result.isAuthenticated).toBe(true);
        expect(mocks.octokitOptions).toEqual([{
            auth: 'legacy-token',
        }]);
        expect(mocks.hasEntitlement).not.toHaveBeenCalled();
    });

    test('does not fall back when GitHub App token resolution fails', async () => {
        const error = new Error('rate limited');
        mocks.hasEntitlement.mockResolvedValue(true);
        mocks.getInstallationToken.mockRejectedValue(error);

        await expect(createOctokit({
            token: 'legacy-token',
            owner: 'example',
            context: 'org example',
        })).rejects.toBe(error);
        expect(mocks.octokitOptions).toEqual([]);
    });

    test('warns and continues when the GitHub App is not installed for one organization', async () => {
        mocks.hasEntitlement.mockResolvedValue(true);
        mocks.getInstallationToken.mockImplementation(async (owner: string) => {
            if (owner === 'invalid-org') {
                throw new mocks.GithubAppInstallationNotFoundError(owner, 'github.com');
            }
            return 'installation-token';
        });

        const result = await getGitHubReposFromConfig({
            type: 'github',
            orgs: ['valid-org', 'invalid-org'],
        }, new AbortController().signal);

        expect(result.repos.map(repo => repo.full_name)).toEqual(['valid-org/repo']);
        expect(result.warnings).toEqual([
            'GitHub App installation not found for github.com/invalid-org',
        ]);
        expect(mocks.logger.warn).toHaveBeenCalledWith(
            'GitHub App installation not found for github.com/invalid-org',
        );
        expect(mocks.logger.error).not.toHaveBeenCalled();
    });
});
