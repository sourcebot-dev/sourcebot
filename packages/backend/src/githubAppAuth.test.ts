import type { Octokit } from '@octokit/rest';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    appsConfigured: vi.fn(),
    ensureInitialized: vi.fn(),
    getInstallationToken: vi.fn(),
    hasEntitlement: vi.fn(),
}));

vi.mock('@sentry/node', () => ({
    captureException: vi.fn(),
}));

vi.mock('@sourcebot/shared', () => ({
    createLogger: vi.fn(() => ({
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    })),
    env: {
        FALLBACK_GITHUB_CLOUD_TOKEN: undefined,
    },
    getTokenFromConfig: vi.fn(),
}));

vi.mock('./entitlements.js', () => ({
    hasEntitlement: mocks.hasEntitlement,
}));

vi.mock('./ee/githubAppManager.js', () => ({
    GithubAppManager: {
        getInstance: () => ({
            appsConfigured: mocks.appsConfigured,
            ensureInitialized: mocks.ensureInitialized,
            getInstallationToken: mocks.getInstallationToken,
        }),
    },
}));

import { getOctokitWithGithubApp } from './github.js';

describe('getOctokitWithGithubApp', () => {
    beforeEach(() => {
        mocks.appsConfigured.mockReset().mockReturnValue(true);
        mocks.ensureInitialized.mockReset().mockResolvedValue(undefined);
        mocks.getInstallationToken.mockReset().mockResolvedValue('installation-token');
        mocks.hasEntitlement.mockReset();
    });

    test('fails safely, then uses the GitHub App when the entitlement appears after startup', async () => {
        const fallbackOctokit = {} as Octokit;
        mocks.hasEntitlement
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true);

        await expect(getOctokitWithGithubApp(
            fallbackOctokit,
            'example',
            undefined,
            'org example',
        )).rejects.toThrow('GitHub App authentication is not currently licensed for org example.');

        const entitledOctokit = await getOctokitWithGithubApp(
            fallbackOctokit,
            'example',
            undefined,
            'org example',
        );

        expect(mocks.ensureInitialized).toHaveBeenCalledTimes(2);
        expect(mocks.getInstallationToken).toHaveBeenCalledWith('example', 'github.com');
        expect(entitledOctokit).not.toBe(fallbackOctokit);
    });

    test('uses legacy authentication when no GitHub App is configured', async () => {
        const fallbackOctokit = {} as Octokit;
        mocks.appsConfigured.mockReturnValue(false);
        mocks.hasEntitlement.mockResolvedValue(false);

        await expect(getOctokitWithGithubApp(
            fallbackOctokit,
            'example',
            undefined,
            'org example',
        )).resolves.toBe(fallbackOctokit);

        expect(mocks.hasEntitlement).not.toHaveBeenCalled();
    });

    test('does not fall back when GitHub App token resolution fails', async () => {
        const error = new Error('rate limited');
        mocks.hasEntitlement.mockResolvedValue(true);
        mocks.getInstallationToken.mockRejectedValue(error);

        await expect(getOctokitWithGithubApp(
            {} as Octokit,
            'example',
            undefined,
            'org example',
        )).rejects.toBe(error);
    });
});
