import { expect, test } from 'vitest';
import { isAllRepoReindexingRequired, isRepoReindexingRequired } from './main';
import { Repository, Settings } from './types';

test('isRepoReindexingRequired should return false when no changes are made', () => {
    const previous: Repository = {
        vcs: 'git',
        name: 'test',
        id: 'test',
        path: '',
        cloneUrl: '',
        isStale: false,
        branches: ['main'],
        tags: ['v1.0'],
    };
    const current = previous;

    expect(isRepoReindexingRequired(previous, current)).toBe(false);
})

test('isRepoReindexingRequired should return true when git branches change', () => {
    const previous: Repository = {
        vcs: 'git',
        name: 'test',
        id: 'test',
        path: '',
        cloneUrl: '',
        isStale: false,
        branches: ['main'],
        tags: ['v1.0'],
    };

    const current: Repository = {
        ...previous,
        branches: ['main', 'feature']
    };

    expect(isRepoReindexingRequired(previous, current)).toBe(true);
});

test('isRepoReindexingRequired should return true when git tags change', () => {
    const previous: Repository = {
        vcs: 'git',
        name: 'test',
        id: 'test',
        path: '',
        cloneUrl: '',
        isStale: false,
        branches: ['main'],
        tags: ['v1.0'],
    };

    const current: Repository = {
        ...previous,
        tags: ['v1.0', 'v2.0']
    };

    expect(isRepoReindexingRequired(previous, current)).toBe(true);
});

test('isRepoReindexingRequired should return true when local excludedPaths change', () => {
    const previous: Repository = {
        vcs: 'local',
        name: 'test',
        id: 'test',
        path: '/',
        isStale: false,
        excludedPaths: ['node_modules'],
        watch: false,
    };

    const current: Repository = {
        ...previous,
        excludedPaths: ['node_modules', 'dist']
    };

    expect(isRepoReindexingRequired(previous, current)).toBe(true);
});

test('isAllRepoReindexingRequired should return false when fileLimitSize has not changed', () => {
    const previous: Settings = {
        maxFileSize: 1000,
        autoDeleteStaleRepos: true,
    }
    const current: Settings = {
        ...previous,
    }
    expect(isAllRepoReindexingRequired(previous, current)).toBe(false);
});

test('isAllRepoReindexingRequired should return true when fileLimitSize has changed', () => {
    const previous: Settings = {
        maxFileSize: 1000,
        autoDeleteStaleRepos: true,
    }
    const current: Settings = {
        ...previous,
        maxFileSize: 2000,
    }
    expect(isAllRepoReindexingRequired(previous, current)).toBe(true);
});

test('isAllRepoReindexingRequired should return false when autoDeleteStaleRepos has changed', () => {
    const previous: Settings = {
        maxFileSize: 1000,
        autoDeleteStaleRepos: true,
    }
    const current: Settings = {
        ...previous,
        autoDeleteStaleRepos: false,
    }
    expect(isAllRepoReindexingRequired(previous, current)).toBe(false);
});