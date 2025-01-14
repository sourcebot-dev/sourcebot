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