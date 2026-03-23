import { expect, test } from 'vitest';
import { shouldExcludeProject } from './gitlab';
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
