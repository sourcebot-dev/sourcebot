import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    loadConfig: vi.fn(),
}));

vi.mock('@sourcebot/shared', () => ({
    createLogger: vi.fn(() => ({
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    })),
    env: { CONFIG_PATH: '/tmp/config.json' },
    getTokenFromConfig: vi.fn(),
    loadConfig: mocks.loadConfig,
}));

vi.mock('@octokit/app', () => ({
    App: vi.fn(),
}));

const getManager = async () => {
    const { GithubAppManager } = await import('./githubAppManager.js');
    return GithubAppManager.getInstance();
};

describe('GithubAppManager.ensureInitialized', () => {
    beforeEach(() => {
        vi.resetModules();
        mocks.loadConfig.mockReset();
    });

    test('shares initialization across concurrent callers', async () => {
        mocks.loadConfig.mockResolvedValue({});
        const manager = await getManager();

        await Promise.all([
            manager.ensureInitialized(),
            manager.ensureInitialized(),
        ]);

        expect(mocks.loadConfig).toHaveBeenCalledTimes(1);
    });

    test('retries initialization after a transient failure', async () => {
        mocks.loadConfig
            .mockRejectedValueOnce(new Error('GitHub unavailable'))
            .mockResolvedValueOnce({});
        const manager = await getManager();

        await expect(manager.ensureInitialized()).rejects.toThrow('GitHub unavailable');
        await expect(manager.ensureInitialized()).resolves.toBeUndefined();

        expect(mocks.loadConfig).toHaveBeenCalledTimes(2);
    });
});
