import { readFile } from 'fs/promises';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { DEFAULT_CONFIG_SETTINGS } from './constants.js';
import { getConfigSettings } from './utils.js';

// Mock fs/promises so loadConfig doesn't hit the filesystem.
// The config schema has no required fields, so '{}' is valid.
vi.mock('fs/promises', () => ({
    readFile: vi.fn().mockResolvedValue('{}'),
}));

// Mock env module to allow overriding env vars in tests
vi.mock('./env.server.js', async (importOriginal) => {
    const original = await importOriginal() as Record<string, unknown>;
    return {
        ...original,
        env: {
            ...(original.env as Record<string, unknown>),
            REINDEX_INTERVAL_MS: undefined,
            RESYNC_CONNECTION_INTERVAL_MS: undefined,
            REINDEX_REPO_POLLING_INTERVAL_MS: undefined,
            RESYNC_CONNECTION_POLLING_INTERVAL_MS: undefined,
        },
    };
});

const mockConfigFile = (settings?: object) => {
    vi.mocked(readFile).mockResolvedValueOnce(
        JSON.stringify(settings !== undefined ? { settings } : {}) as any
    );
};

const mockEnvVars = async (envOverrides: Record<string, number | undefined>) => {
    const envModule = await import('./env.server.js');
    Object.assign(envModule.env, envOverrides);
};

describe('getConfigSettings', () => {
    beforeEach(async () => {
        vi.mocked(readFile).mockResolvedValue('{}' as any);
        // Reset env vars to undefined before each test
        await mockEnvVars({
            REINDEX_INTERVAL_MS: undefined,
            RESYNC_CONNECTION_INTERVAL_MS: undefined,
            REINDEX_REPO_POLLING_INTERVAL_MS: undefined,
            RESYNC_CONNECTION_POLLING_INTERVAL_MS: undefined,
        });
    });

    test('returns DEFAULT_CONFIG_SETTINGS when no config path is provided', async () => {
        const result = await getConfigSettings(undefined);
        expect(result).toEqual(DEFAULT_CONFIG_SETTINGS);
    });

    test('merges config settings over defaults', async () => {
        mockConfigFile({ maxFileSize: 1024 });
        const result = await getConfigSettings('/config.json');
        expect(result.maxFileSize).toBe(1024);
        // Other defaults are still present
        expect(result.reindexIntervalMs).toBe(DEFAULT_CONFIG_SETTINGS.reindexIntervalMs);
    });

    describe('repoDrivenPermissionSyncIntervalMs', () => {
        test('uses new key when set', async () => {
            mockConfigFile({ repoDrivenPermissionSyncIntervalMs: 5000 });
            const result = await getConfigSettings('/config.json');
            expect(result.repoDrivenPermissionSyncIntervalMs).toBe(5000);
        });

        test('falls back to experiment_ key when new key is not set', async () => {
            mockConfigFile({ experiment_repoDrivenPermissionSyncIntervalMs: 3000 });
            const result = await getConfigSettings('/config.json');
            expect(result.repoDrivenPermissionSyncIntervalMs).toBe(3000);
        });

        test('new key takes precedence over experiment_ key', async () => {
            mockConfigFile({
                repoDrivenPermissionSyncIntervalMs: 5000,
                experiment_repoDrivenPermissionSyncIntervalMs: 3000,
            });
            const result = await getConfigSettings('/config.json');
            expect(result.repoDrivenPermissionSyncIntervalMs).toBe(5000);
        });

        test('defaults to DEFAULT_CONFIG_SETTINGS when neither key is set', async () => {
            mockConfigFile({});
            const result = await getConfigSettings('/config.json');
            expect(result.repoDrivenPermissionSyncIntervalMs).toBe(
                DEFAULT_CONFIG_SETTINGS.repoDrivenPermissionSyncIntervalMs
            );
        });
    });

    describe('userDrivenPermissionSyncIntervalMs', () => {
        test('uses new key when set', async () => {
            mockConfigFile({ userDrivenPermissionSyncIntervalMs: 5000 });
            const result = await getConfigSettings('/config.json');
            expect(result.userDrivenPermissionSyncIntervalMs).toBe(5000);
        });

        test('falls back to experiment_ key when new key is not set', async () => {
            mockConfigFile({ experiment_userDrivenPermissionSyncIntervalMs: 3000 });
            const result = await getConfigSettings('/config.json');
            expect(result.userDrivenPermissionSyncIntervalMs).toBe(3000);
        });

        test('new key takes precedence over experiment_ key', async () => {
            mockConfigFile({
                userDrivenPermissionSyncIntervalMs: 5000,
                experiment_userDrivenPermissionSyncIntervalMs: 3000,
            });
            const result = await getConfigSettings('/config.json');
            expect(result.userDrivenPermissionSyncIntervalMs).toBe(5000);
        });

        test('defaults to DEFAULT_CONFIG_SETTINGS when neither key is set', async () => {
            mockConfigFile({});
            const result = await getConfigSettings('/config.json');
            expect(result.userDrivenPermissionSyncIntervalMs).toBe(
                DEFAULT_CONFIG_SETTINGS.userDrivenPermissionSyncIntervalMs
            );
        });
    });

    describe('env var overrides for sync intervals', () => {
        test('REINDEX_INTERVAL_MS env var overrides config file setting', async () => {
            await mockEnvVars({ REINDEX_INTERVAL_MS: 7200000 });
            mockConfigFile({ reindexIntervalMs: 1800000 });
            const result = await getConfigSettings('/config.json');
            expect(result.reindexIntervalMs).toBe(7200000);
        });

        test('REINDEX_INTERVAL_MS env var overrides default when no config', async () => {
            await mockEnvVars({ REINDEX_INTERVAL_MS: 7200000 });
            const result = await getConfigSettings(undefined);
            expect(result.reindexIntervalMs).toBe(7200000);
        });

        test('RESYNC_CONNECTION_INTERVAL_MS env var overrides config file setting', async () => {
            await mockEnvVars({ RESYNC_CONNECTION_INTERVAL_MS: 43200000 });
            mockConfigFile({ resyncConnectionIntervalMs: 86400000 });
            const result = await getConfigSettings('/config.json');
            expect(result.resyncConnectionIntervalMs).toBe(43200000);
        });

        test('RESYNC_CONNECTION_INTERVAL_MS env var overrides default when no config', async () => {
            await mockEnvVars({ RESYNC_CONNECTION_INTERVAL_MS: 43200000 });
            const result = await getConfigSettings(undefined);
            expect(result.resyncConnectionIntervalMs).toBe(43200000);
        });

        test('REINDEX_REPO_POLLING_INTERVAL_MS env var overrides config file setting', async () => {
            await mockEnvVars({ REINDEX_REPO_POLLING_INTERVAL_MS: 5000 });
            mockConfigFile({ reindexRepoPollingIntervalMs: 2000 });
            const result = await getConfigSettings('/config.json');
            expect(result.reindexRepoPollingIntervalMs).toBe(5000);
        });

        test('REINDEX_REPO_POLLING_INTERVAL_MS env var overrides default when no config', async () => {
            await mockEnvVars({ REINDEX_REPO_POLLING_INTERVAL_MS: 5000 });
            const result = await getConfigSettings(undefined);
            expect(result.reindexRepoPollingIntervalMs).toBe(5000);
        });

        test('RESYNC_CONNECTION_POLLING_INTERVAL_MS env var overrides config file setting', async () => {
            await mockEnvVars({ RESYNC_CONNECTION_POLLING_INTERVAL_MS: 3000 });
            mockConfigFile({ resyncConnectionPollingIntervalMs: 1000 });
            const result = await getConfigSettings('/config.json');
            expect(result.resyncConnectionPollingIntervalMs).toBe(3000);
        });

        test('RESYNC_CONNECTION_POLLING_INTERVAL_MS env var overrides default when no config', async () => {
            await mockEnvVars({ RESYNC_CONNECTION_POLLING_INTERVAL_MS: 3000 });
            const result = await getConfigSettings(undefined);
            expect(result.resyncConnectionPollingIntervalMs).toBe(3000);
        });

        test('multiple env vars can be set simultaneously', async () => {
            await mockEnvVars({
                REINDEX_INTERVAL_MS: 7200000,
                RESYNC_CONNECTION_INTERVAL_MS: 43200000,
                REINDEX_REPO_POLLING_INTERVAL_MS: 5000,
                RESYNC_CONNECTION_POLLING_INTERVAL_MS: 3000,
            });
            mockConfigFile({
                reindexIntervalMs: 1800000,
                resyncConnectionIntervalMs: 86400000,
                reindexRepoPollingIntervalMs: 2000,
                resyncConnectionPollingIntervalMs: 1000,
            });
            const result = await getConfigSettings('/config.json');
            expect(result.reindexIntervalMs).toBe(7200000);
            expect(result.resyncConnectionIntervalMs).toBe(43200000);
            expect(result.reindexRepoPollingIntervalMs).toBe(5000);
            expect(result.resyncConnectionPollingIntervalMs).toBe(3000);
        });

        test('config file values are used when env vars are not set', async () => {
            mockConfigFile({
                reindexIntervalMs: 1800000,
                resyncConnectionIntervalMs: 43200000,
            });
            const result = await getConfigSettings('/config.json');
            expect(result.reindexIntervalMs).toBe(1800000);
            expect(result.resyncConnectionIntervalMs).toBe(43200000);
        });

        test('defaults are used when neither env vars nor config file are set', async () => {
            mockConfigFile({});
            const result = await getConfigSettings('/config.json');
            expect(result.reindexIntervalMs).toBe(DEFAULT_CONFIG_SETTINGS.reindexIntervalMs);
            expect(result.resyncConnectionIntervalMs).toBe(DEFAULT_CONFIG_SETTINGS.resyncConnectionIntervalMs);
            expect(result.reindexRepoPollingIntervalMs).toBe(DEFAULT_CONFIG_SETTINGS.reindexRepoPollingIntervalMs);
            expect(result.resyncConnectionPollingIntervalMs).toBe(DEFAULT_CONFIG_SETTINGS.resyncConnectionPollingIntervalMs);
        });
    });
});
