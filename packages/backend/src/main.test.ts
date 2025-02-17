import { expect, test, vi } from 'vitest';
import { deleteStaleRepository, isAllRepoReindexingRequired, isRepoReindexingRequired } from './main';
import { AppContext, GitRepository, LocalRepository, Repository, Settings } from './types';
import { DEFAULT_DB_DATA } from './db';
import { createMockDB } from './db.test';
import { rm } from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

vi.mock('fs/promises', () => ({
    rm: vi.fn(),
}));

vi.mock('glob', () => ({
    glob: vi.fn().mockReturnValue(['fake_index.zoekt']),
}));

vi.mock('fs', () => ({
    existsSync: vi.fn().mockReturnValue(true),
}));

const createMockContext = (rootPath: string = '/app') => {
    return {
        configPath: path.join(rootPath, 'config.json'),
        cachePath: path.join(rootPath, '.sourcebot'),
        indexPath: path.join(rootPath, '.sourcebot/index'),
        reposPath: path.join(rootPath, '.sourcebot/repos'),
    } satisfies AppContext;
}


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

test('deleteStaleRepository can delete a git repository', async () => {
    const ctx = createMockContext();

    const repo: GitRepository = {
        id: 'github.com/sourcebot-dev/sourcebot',
        vcs: 'git',
        name: 'sourcebot',
        cloneUrl: 'https://github.com/sourcebot-dev/sourcebot',
        path: `${ctx.reposPath}/github.com/sourcebot-dev/sourcebot`,
        branches: ['main'],
        tags: [''],
        isStale: true,
    }

    const db = createMockDB({
        ...DEFAULT_DB_DATA,
        repos: {
            'github.com/sourcebot-dev/sourcebot': repo,
        }
    });


    await deleteStaleRepository(repo, db, ctx);

    expect(db.data.repos['github.com/sourcebot-dev/sourcebot']).toBeUndefined();
    expect(rm).toHaveBeenCalledWith(`${ctx.reposPath}/github.com/sourcebot-dev/sourcebot`, {
        recursive: true,
    });
    expect(glob).toHaveBeenCalledWith(`github.com%2Fsourcebot-dev%2Fsourcebot*.zoekt`, {
        cwd: ctx.indexPath,
        absolute: true
    });
    expect(rm).toHaveBeenCalledWith(`fake_index.zoekt`);
});

test('deleteStaleRepository can delete a local repository', async () => {
    const ctx = createMockContext();

    const repo: LocalRepository = {
        vcs: 'local',
        name: 'UnrealEngine',
        id: '/path/to/UnrealEngine',
        path: '/path/to/UnrealEngine',
        watch: false,
        excludedPaths: [],
        isStale: true,
    }

    const db = createMockDB({
        ...DEFAULT_DB_DATA,
        repos: {
            '/path/to/UnrealEngine': repo,
        }
    });

    await deleteStaleRepository(repo, db, ctx);

    expect(db.data.repos['/path/to/UnrealEngine']).toBeUndefined();
    expect(rm).not.toHaveBeenCalledWith('/path/to/UnrealEngine');
    expect(glob).toHaveBeenCalledWith(`UnrealEngine*.zoekt`, {
        cwd: ctx.indexPath,
        absolute: true
    });
    expect(rm).toHaveBeenCalledWith('fake_index.zoekt');
});