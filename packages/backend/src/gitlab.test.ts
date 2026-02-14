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

test('shouldExcludeProject returns true when project size is less than exclude.size.min.', () => {
    const project = {
        path_with_namespace: 'test/project',
        statistics: {
            storage_size: 99,
        },
    } as unknown as ProjectSchema;

    expect(shouldExcludeProject({
        project,
        exclude: {
            size: {
                min: 100,
            },
        },
    })).toBe(true);
});

test('shouldExcludeProject returns true when project size is greater than exclude.size.max.', () => {
    const project = {
        path_with_namespace: 'test/project',
        statistics: {
            storage_size: 101,
        },
    } as unknown as ProjectSchema;

    expect(shouldExcludeProject({
        project,
        exclude: {
            size: {
                max: 100,
            },
        },
    })).toBe(true);
});

test('shouldExcludeProject returns false when project size is within exclude.size bounds.', () => {
    const project = {
        path_with_namespace: 'test/project',
        statistics: {
            storage_size: 100,
        },
    } as unknown as ProjectSchema;

    expect(shouldExcludeProject({
        project,
        exclude: {
            size: {
                min: 100,
                max: 100,
            },
        },
    })).toBe(false);
});

test('shouldExcludeProject returns false when exclude.size is set but project statistics are unavailable.', () => {
    const project = {
        path_with_namespace: 'test/project',
    } as ProjectSchema;

    expect(shouldExcludeProject({
        project,
        exclude: {
            size: {
                min: 100,
            },
        },
    })).toBe(false);
});
