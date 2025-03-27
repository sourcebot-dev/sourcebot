import { expect, test } from 'vitest';
import { OctokitRepository, shouldExcludeRepo } from './github';

test('shouldExcludeRepo returns true when clone_url is undefined', () => {
    const repo = { full_name: 'test/repo' } as OctokitRepository;

    expect(shouldExcludeRepo({
        repo,
    })).toBe(true);
});

test('shouldExcludeRepo returns false when the repo is not excluded.', () => {
    const repo = {
        full_name: 'test/repo',
        clone_url: 'https://github.com/test/repo.git',
    } as OctokitRepository;

    expect(shouldExcludeRepo({
        repo,
    })).toBe(false);
});

test('shouldExcludeRepo handles forked repos correctly', () => {
    const repo = {
        full_name: 'test/forked-repo',
        clone_url: 'https://github.com/test/forked-repo.git',
        fork: true,
    } as OctokitRepository;

    expect(shouldExcludeRepo({ repo })).toBe(false);
    expect(shouldExcludeRepo({ repo, exclude: { forks: true } })).toBe(true);
    expect(shouldExcludeRepo({ repo, exclude: { forks: false } })).toBe(false);
});;

test('shouldExcludeRepo handles archived repos correctly', () => {
    const repo = {
        full_name: 'test/archived-repo',
        clone_url: 'https://github.com/test/archived-repo.git',
        archived: true,
    } as OctokitRepository;

    expect(shouldExcludeRepo({ repo })).toBe(false);
    expect(shouldExcludeRepo({ repo, exclude: { archived: true } })).toBe(true);
    expect(shouldExcludeRepo({ repo, exclude: { archived: false } })).toBe(false);
});

test('shouldExcludeRepo handles include.topics correctly', () => {
    const repo = {
        full_name: 'test/repo',
        clone_url: 'https://github.com/test/repo.git',
        topics: [
            'test-topic',
            'another-topic'
        ] as string[],
    } as OctokitRepository;

    expect(shouldExcludeRepo({
        repo,
        include: {}
    })).toBe(false);
    expect(shouldExcludeRepo({
        repo,
        include: {
            topics: [],
        }
    })).toBe(true);
    expect(shouldExcludeRepo({
        repo,
        include: {
            topics: ['a-topic-that-does-not-exist'],
        }
    })).toBe(true);
    expect(shouldExcludeRepo({
        repo,
        include: {
            topics: ['test-topic'],
        }
    })).toBe(false);
    expect(shouldExcludeRepo({
        repo,
        include: {
            topics: ['test-*'],
        }
    })).toBe(false);
    expect(shouldExcludeRepo({
        repo,
        include: {
            topics: ['TEST-tOpIC'],
        }
    })).toBe(false);
});

test('shouldExcludeRepo handles exclude.topics correctly', () => {
    const repo = {
        full_name: 'test/repo',
        clone_url: 'https://github.com/test/repo.git',
        topics: [
            'test-topic',
            'another-topic'
        ],
    } as OctokitRepository;

    expect(shouldExcludeRepo({
        repo,
        exclude: {}
    })).toBe(false);
    expect(shouldExcludeRepo({
        repo,
        exclude: {
            topics: [],
        }
    })).toBe(false);
    expect(shouldExcludeRepo({
        repo,
        exclude: {
            topics: ['a-topic-that-does-not-exist'],
        }
    })).toBe(false);
    expect(shouldExcludeRepo({
        repo,
        exclude: {
            topics: ['test-topic'],
        }
    })).toBe(true);
    expect(shouldExcludeRepo({
        repo,
        exclude: {
            topics: ['test-*'],
        }
    })).toBe(true);
    expect(shouldExcludeRepo({
        repo,
        exclude: {
            topics: ['TEST-tOpIC'],
        }
    })).toBe(true);
});


test('shouldExcludeRepo handles exclude.size correctly', () => {
    const repo = {
        full_name: 'test/repo',
        clone_url: 'https://github.com/test/repo.git',
        size: 6, // 6KB
    } as OctokitRepository;

    expect(shouldExcludeRepo({
        repo,
        exclude: {
            size: {
                min: 10 * 1000, // 10KB
            }
        }
    })).toBe(true);

    expect(shouldExcludeRepo({
        repo,
        exclude: {
            size: {
                max: 2 * 1000, // 2KB
            }
        }
    })).toBe(true);

    expect(shouldExcludeRepo({
        repo,
        exclude: {
            size: {
                min: 5 * 1000, // 5KB
                max: 10 * 1000, // 10KB
            }
        }
    })).toBe(false);
});

test('shouldExcludeRepo handles exclude.repos correctly', () => {
    const repo = {
        full_name: 'test/example-repo',
        clone_url: 'https://github.com/test/example-repo.git',
    } as OctokitRepository;

    expect(shouldExcludeRepo({
        repo,
        exclude: {
            repos: []
        }
    })).toBe(false);
    expect(shouldExcludeRepo({
        repo,
        exclude: {
            repos: ['test/example-repo']
        }
    })).toBe(true);
    expect(shouldExcludeRepo({
        repo,
        exclude: {
            repos: ['test/*']
        }
    })).toBe(true);
    expect(shouldExcludeRepo({
        repo,
        exclude: {
            repos: ['repo-does-not-exist']
        }
    })).toBe(false);
});
