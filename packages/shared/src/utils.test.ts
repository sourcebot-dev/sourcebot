import { readFile } from 'fs/promises';
import { existsSync, mkdtempSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { DEFAULT_CONFIG_SETTINGS } from './constants.js';
import type { Repo } from '@sourcebot/db';
import {
    getConfigSettings,
    getRepoPath,
    normalizeLegacyFileURLPathname,
    resolveConfigSettings,
} from './utils.js';

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

    const localPath = (...parts: string[]) =>
        `${process.platform === 'win32' ? 'C:\\' : '/'}${parts.join('/')}`;

    test(
        'normalizes legacy Windows file URL pathnames before checking the filesystem',
        () => {
            expect(
                normalizeLegacyFileURLPathname('/C:/Users/me/100%20Free', 'win32'),
            ).toBe('C:\\Users\\me\\100%20Free');
            expect(
                normalizeLegacyFileURLPathname('/repos/100%20Free', 'win32'),
            ).toBe('/repos/100%20Free');
        },
    );

    test('returns the on-disk path of a local repository', () => {
        const repoPath = localPath('repos', 'project');
        expect(getRepoPath(localRepo(pathToFileURL(repoPath).href))).toEqual({
            path: fileURLToPath(pathToFileURL(repoPath)),
            isReadOnly: true,
        });
    });

    test('returns the on-disk path of a local repository whose path contains spaces', () => {
        const repoPath = localPath('Users', 'me', 'Code Projects', 'my repo');
        expect(getRepoPath(localRepo(pathToFileURL(repoPath).href))).toEqual({
            path: fileURLToPath(pathToFileURL(repoPath)),
            isReadOnly: true,
        });
    });

    test('returns the on-disk path of a local repository whose path contains percent-encodable characters', () => {
        const repoPath = localPath('repos', 'caf\u00e9', '[legacy]');
        expect(getRepoPath(localRepo(pathToFileURL(repoPath).href))).toEqual({
            path: fileURLToPath(pathToFileURL(repoPath)),
            isReadOnly: true,
        });
    });

    test.each(['file:///repos/100%Free', 'file:///repos/report%2F2024'])(
        'preserves a legacy raw file URL pathname containing %s', (cloneUrl) => {
            const url = new URL(cloneUrl);
            expect(getRepoPath(localRepo(cloneUrl))).toEqual({
                path: url.pathname,
                isReadOnly: true,
            });
        },
    );

    test('preserves a legacy local path containing a valid percent escape when that path exists', () => {
        const tempRoot = mkdtempSync(path.join(tmpdir(), 'sourcebot-local-repo-'));
        const repoPath = path.join(tempRoot, '100%20Free');
        mkdirSync(repoPath);

        try {
            // Older records stored `file://` plus the raw path, so `%20` here
            // is a literal part of the directory name rather than an escape.
            expect(getRepoPath(localRepo(`file://${repoPath}`))).toEqual({
                path: repoPath,
                isReadOnly: true,
            });
        } finally {
            rmSync(tempRoot, { recursive: true, force: true });
        }
    });
});
