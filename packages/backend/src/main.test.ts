import { expect, test } from 'vitest';
import { isRepoReindxingRequired } from './main';
import { Repository } from './types';

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

    expect(isRepoReindxingRequired(previous, current)).toBe(false);
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

    expect(isRepoReindxingRequired(previous, current)).toBe(true);
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

    expect(isRepoReindxingRequired(previous, current)).toBe(true);
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

    expect(isRepoReindxingRequired(previous, current)).toBe(true);
});
