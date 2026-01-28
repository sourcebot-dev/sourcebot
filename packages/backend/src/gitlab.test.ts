import { expect, test, vi, describe, beforeEach } from 'vitest';
import { shouldExcludeProject, parseQuery, getGitLabReposFromConfig } from './gitlab';
import { ProjectSchema } from '@gitbeaker/rest';

// Mock dependencies
const mockGitlabAll = vi.fn();

vi.mock('@gitbeaker/rest', () => {
    return {
        Gitlab: vi.fn().mockImplementation(() => ({
            Projects: {
                all: mockGitlabAll,
            }
        })),
    };
});

vi.mock('@sourcebot/shared', async () => ({
    getTokenFromConfig: vi.fn(),
    createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
    }),
    env: {
        GITLAB_CLIENT_QUERY_TIMEOUT_SECONDS: 10,
    }
}));

vi.mock('./connectionUtils', () => ({
    processPromiseResults: (results: any[]) => {
        const validItems = results
            .filter((r) => r.status === 'fulfilled' && r.value.type === 'valid')
            .flatMap((r) => r.value.data);
        return { validItems, warnings: [] };
    },
    throwIfAnyFailed: vi.fn(),
}));

vi.mock('./utils', () => ({
    measure: async (fn: () => any) => {
        const data = await fn();
        return { durationMs: 0, data };
    },
    fetchWithRetry: async (fn: () => any) => fn(),
}));
import { shouldExcludeProject, parseQuery } from './gitlab';
import { ProjectSchema } from '@gitbeaker/rest';


test('shouldExcludeProject returns false when the project is not excluded.', () => {
    const project = {
        path_with_namespace: 'test/project',
    } as ProjectSchema;

    expect(shouldExcludeProject({
        project,
    })).toBe(false);
});

test('shouldExcludeProject returns true when the project is excluded by exclude.archived.', () => {
    const project = {
        path_with_namespace: 'test/project',
        archived: true,
    } as ProjectSchema;

    expect(shouldExcludeProject({
        project,
        exclude: {
            archived: true,
        }
    })).toBe(true)
});

test('shouldExcludeProject returns true when the project is excluded by exclude.forks.', () => {
    const project = {
        path_with_namespace: 'test/project',
        forked_from_project: {}
    } as unknown as ProjectSchema;

    expect(shouldExcludeProject({
        project,
        exclude: {
            forks: true,
        }
    })).toBe(true)
});

test('shouldExcludeProject returns true when the project is excluded by exclude.userOwnedProjects.', () => {
    const project = {
        path_with_namespace: 'test/project',
        namespace: {
            kind: 'user',
        }
    } as unknown as ProjectSchema;

    expect(shouldExcludeProject({
        project,
        exclude: {
            userOwnedProjects: true,
        }
    })).toBe(true)
});

test('shouldExcludeProject returns false when exclude.userOwnedProjects is true but project is group-owned.', () => {
    const project = {
        path_with_namespace: 'test/project',
        namespace: { kind: 'group' },
    } as unknown as ProjectSchema;

    expect(shouldExcludeProject({
        project,
        exclude: { userOwnedProjects: true },
    })).toBe(false);
});

test('parseQuery correctly parses query strings', () => {
    expect(parseQuery('projects?include_subgroups=true&archived=false&id=123')).toEqual({
        include_subgroups: true,
        archived: false,
        id: 123
    });
    expect(parseQuery('projects?search=foo')).toEqual({
        search: 'foo'
    });
    expect(parseQuery('groups/1/projects?simple=true')).toEqual({
        simple: true
    });
});

describe('getGitLabReposFromConfig', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('fetches projects using projectQuery and deduplicates results', async () => {
        const mockProjects1 = [
            { id: 1, path_with_namespace: 'group1/project1', name: 'project1' },
            { id: 2, path_with_namespace: 'group1/project2', name: 'project2' },
        ];
        const mockProjects2 = [
            { id: 2, path_with_namespace: 'group1/project2', name: 'project2' }, // Duplicate
            { id: 3, path_with_namespace: 'group2/project3', name: 'project3' },
        ];

        mockGitlabAll.mockResolvedValueOnce(mockProjects1);
        mockGitlabAll.mockResolvedValueOnce(mockProjects2);

        const config = {
            type: 'gitlab' as const,
            projectQuery: [
                'groups/group1/projects?include_subgroups=true',
                'projects?topic=devops'
            ]
        };

        const result = await getGitLabReposFromConfig(config);

        // Verify API calls
        expect(mockGitlabAll).toHaveBeenCalledTimes(2);
        expect(mockGitlabAll).toHaveBeenCalledWith(expect.objectContaining({
            perPage: 100,
            include_subgroups: true
        }));
        expect(mockGitlabAll).toHaveBeenCalledWith(expect.objectContaining({
            perPage: 100,
            topic: 'devops'
        }));

        // Verify deduplication
        expect(result.repos).toHaveLength(3);
        const projectIds = result.repos.map((p: any) => p.id).sort();
        expect(projectIds).toEqual([1, 2, 3]);
    });
});
