import { describe, expect, test } from 'vitest';
import {
    getLegacyRecentlyOpenedFilesStorageKey,
    getRecentlyOpenedFilesStorageKey,
    shouldMigrateLegacyRecentlyOpenedFiles,
} from './fileSearchRecents';

describe('getRecentlyOpenedFilesStorageKey', () => {
    test('scopes recently opened files by repo and revision', () => {
        const mainKey = getRecentlyOpenedFilesStorageKey({
            repoName: 'github.com/sourcebot-dev/sourcebot',
            revisionName: 'main',
        });
        const featureKey = getRecentlyOpenedFilesStorageKey({
            repoName: 'github.com/sourcebot-dev/sourcebot',
            revisionName: 'feature/file-search',
        });

        expect(mainKey).not.toBe(featureKey);
    });

    test('uses HEAD when revision is omitted', () => {
        expect(getRecentlyOpenedFilesStorageKey({
            repoName: 'github.com/sourcebot-dev/sourcebot',
            revisionName: undefined,
        })).toBe('recentlyOpenedFiles:github.com%2Fsourcebot-dev%2Fsourcebot:HEAD');
    });

    test('encodes repo and revision delimiters before building the key', () => {
        expect(getRecentlyOpenedFilesStorageKey({
            repoName: 'example.com/org:repo@name',
            revisionName: 'feature:one/two',
        })).toBe('recentlyOpenedFiles:example.com%2Forg%3Arepo%40name:feature%3Aone%2Ftwo');
    });

    test('keeps the legacy repo-scoped key available for migration', () => {
        expect(getLegacyRecentlyOpenedFilesStorageKey({
            repoName: 'github.com/sourcebot-dev/sourcebot',
        })).toBe('recentlyOpenedFiles-github.com/sourcebot-dev/sourcebot');
    });

    test('only migrates legacy recents into the default revision context', () => {
        expect(shouldMigrateLegacyRecentlyOpenedFiles({ revisionName: undefined })).toBe(true);
        expect(shouldMigrateLegacyRecentlyOpenedFiles({ revisionName: 'HEAD' })).toBe(true);
        expect(shouldMigrateLegacyRecentlyOpenedFiles({ revisionName: 'main' })).toBe(false);
        expect(shouldMigrateLegacyRecentlyOpenedFiles({ revisionName: 'feature/file-search' })).toBe(false);
    });
});
