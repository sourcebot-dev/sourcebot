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

test('shouldExcludeProject returns true when the project is excluded by exclude.groups.', () => {
    const project = {
        path_with_namespace: 'test/project',
    } as ProjectSchema;

    expect(shouldExcludeProject({
        project,
        exclude: {
            groups: ['test'],
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

