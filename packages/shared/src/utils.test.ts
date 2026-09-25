import { readFile } from 'fs/promises';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { DEFAULT_CONFIG_SETTINGS } from './constants.js';
import type { Repo } from '@sourcebot/db';
import { getConfigSettings, getRepoPath, resolveConfigSettings } from './utils.js';

// Mock fs/promises so loadConfig doesn't hit the filesystem.
// The config schema has no required fields, so '{}' is valid.
vi.mock('fs/promises', () => ({
    readFile: vi.fn().mockResolvedValue('{}'),
}));

const mockConfigFile = (settings?: object) => {
    vi.mocked(readFile).mockResolvedValueOnce(
        JSON.stringify(settings !== undefined ? { settings } : {}) as any
    );
};

describe('getConfigSettings', () => {
    beforeEach(() => {
        vi.mocked(readFile).mockResolvedValue('{}' as any);
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
});

describe('resolveConfigSettings', () => {
    test('resolves settings from an already-loaded config', () => {
        const result = resolveConfigSettings({
            settings: {
                resyncConnectionIntervalMs: 12_345,
            },
        });

        expect(result.resyncConnectionIntervalMs).toBe(12_345);
        expect(result.reindexIntervalMs).toBe(
            DEFAULT_CONFIG_SETTINGS.reindexIntervalMs,
        );
    });
});

describe('getRepoPath', () => {
    const localRepo = (cloneUrl: string) => ({
        id: 1,
        external_codeHostType: 'genericGitHost',
        cloneUrl,
    }) as unknown as Repo;

    test('returns the on-disk path of a local repository', () => {
        expect(getRepoPath(localRepo('file:///repos/project'))).toEqual({
            path: '/repos/project',
            isReadOnly: true,
        });
    });

    test('returns the on-disk path of a local repository whose path contains spaces', () => {
        expect(getRepoPath(localRepo('file:///Users/me/Code Projects/my repo'))).toEqual({
            path: '/Users/me/Code Projects/my repo',
            isReadOnly: true,
        });
    });

    test('returns the on-disk path of a local repository whose path contains percent-encodable characters', () => {
        expect(getRepoPath(localRepo('file:///repos/caf\u00e9/[legacy]'))).toEqual({
            path: '/repos/caf\u00e9/[legacy]',
            isReadOnly: true,
        });
    });
});
