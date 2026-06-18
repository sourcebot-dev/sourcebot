import { expect, test, vi } from 'vitest';
import { getGitLabProjectsForGroupTree, shouldExcludeProject } from './gitlab';
import { Gitlab, GroupSchema, ProjectSchema } from '@gitbeaker/rest';


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

test('shouldExcludeProject returns true when include.topics does not match project topics.', () => {
    const project = {
        path_with_namespace: 'test/project',
        topics: ['frontend'],
    } as unknown as ProjectSchema;

    expect(shouldExcludeProject({
        project,
        include: { topics: ['backend'] },
    })).toBe(true);
});

test('shouldExcludeProject returns false when include.topics matches at least one project topic.', () => {
    const project = {
        path_with_namespace: 'test/project',
        topics: ['frontend', 'backend'],
    } as unknown as ProjectSchema;

    expect(shouldExcludeProject({
        project,
        include: { topics: ['backend'] },
    })).toBe(false);
});

test('shouldExcludeProject returns true when include.topics is set but project has no topics.', () => {
    const project = {
        path_with_namespace: 'test/project',
        topics: [],
    } as unknown as ProjectSchema;

    expect(shouldExcludeProject({
        project,
        include: { topics: ['backend'] },
    })).toBe(true);
});

test('shouldExcludeProject returns false when include.topics matches via glob pattern.', () => {
    const project = {
        path_with_namespace: 'test/project',
        topics: ['core-api'],
    } as unknown as ProjectSchema;

    expect(shouldExcludeProject({
        project,
        include: { topics: ['core-*'] },
    })).toBe(false);
});

test('shouldExcludeProject returns true when exclude.topics matches a project topic.', () => {
    const project = {
        path_with_namespace: 'test/project',
        topics: ['deprecated'],
    } as unknown as ProjectSchema;

    expect(shouldExcludeProject({
        project,
        exclude: { topics: ['deprecated'] },
    })).toBe(true);
});

test('shouldExcludeProject returns false when exclude.topics does not match any project topic.', () => {
    const project = {
        path_with_namespace: 'test/project',
        topics: ['backend'],
    } as unknown as ProjectSchema;

    expect(shouldExcludeProject({
        project,
        exclude: { topics: ['deprecated'] },
    })).toBe(false);
});

test('shouldExcludeProject include.topics matching is case-sensitive on the project side.', () => {
    const project = {
        path_with_namespace: 'test/project',
        topics: ['Backend'],
    } as unknown as ProjectSchema;

    // The function lowercases config topics but not project topics,
    // so 'Backend' does not match the lowercased pattern 'backend'.
    expect(shouldExcludeProject({
        project,
        include: { topics: ['backend'] },
    })).toBe(true);
});

test('getGitLabProjectsForGroupTree walks paginated subgroup trees without includeSubgroups queries.', async () => {
    const rootProjectPage1 = {
        id: 1,
        path_with_namespace: 'root/project-a',
    } as ProjectSchema;
    const rootProjectPage2 = {
        id: 2,
        path_with_namespace: 'root/project-b',
    } as ProjectSchema;
    const childProject = {
        id: 3,
        path_with_namespace: 'root/child/project-c',
    } as ProjectSchema;
    const grandchildProject = {
        id: 4,
        path_with_namespace: 'root/child/grandchild/project-d',
    } as ProjectSchema;

    const projectsByGroupPage = new Map<string, ProjectSchema[]>([
        ['root:1', [rootProjectPage1]],
        ['root:2', [rootProjectPage2]],
        ['root/child:1', [childProject]],
        ['root/child/grandchild:1', [grandchildProject]],
    ]);

    const subgroupsByGroupPage = new Map<string, GroupSchema[]>([
        ['root:1', [
            {
                id: 10,
                full_path: 'root/child',
            } as GroupSchema,
        ]],
        ['root:2', [
            {
                id: 11,
                full_path: 'root/other-child',
            } as GroupSchema,
        ]],
        ['root/child:1', [
            {
                id: 12,
                full_path: 'root/child/grandchild',
            } as GroupSchema,
        ]],
    ]);

    const api = {
        Groups: {
            allProjects: vi.fn(async (group: string | number, options: { page: number }) => ({
                data: projectsByGroupPage.get(`${group}:${options.page}`) ?? [],
                paginationInfo: {
                    next: group === 'root' && options.page === 1 ? 2 : null,
                },
            })),
            allSubgroups: vi.fn(async (group: string | number, options: { page: number }) => ({
                data: subgroupsByGroupPage.get(`${group}:${options.page}`) ?? [],
                paginationInfo: {
                    next: group === 'root' && options.page === 1 ? 2 : null,
                },
            })),
        },
    } as unknown as InstanceType<typeof Gitlab>;

    const projects = await getGitLabProjectsForGroupTree(api, 'root');

    expect(projects.map(project => project.path_with_namespace)).toEqual([
        'root/project-a',
        'root/project-b',
        'root/child/project-c',
        'root/child/grandchild/project-d',
    ]);

    expect(api.Groups.allProjects).toHaveBeenCalledWith('root', expect.objectContaining({
        page: 1,
        perPage: 100,
        pagination: 'offset',
        showExpanded: true,
        includeSubgroups: false,
    }));
    expect(api.Groups.allProjects).toHaveBeenCalledWith('root', expect.objectContaining({
        page: 2,
        includeSubgroups: false,
    }));
    expect(api.Groups.allProjects).toHaveBeenCalledWith('root/child', expect.objectContaining({
        includeSubgroups: false,
    }));
    expect(api.Groups.allProjects).toHaveBeenCalledWith('root/child/grandchild', expect.objectContaining({
        includeSubgroups: false,
    }));
    expect(api.Groups.allProjects).toHaveBeenCalledWith('root/other-child', expect.objectContaining({
        includeSubgroups: false,
    }));
    expect(api.Groups.allProjects).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        includeSubgroups: true,
    }));
});
