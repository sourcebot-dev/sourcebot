import { expect, test, describe } from 'vitest';
import { cloudShouldExcludeRepo, serverShouldExcludeRepo, BitbucketRepository } from './bitbucket';
import { BitbucketConnectionConfig } from '@sourcebot/schemas/v3/bitbucket.type';
import { SchemaRepository as CloudRepository } from '@coderabbitai/bitbucket/cloud/openapi';
import { SchemaRestRepository as ServerRepository } from '@coderabbitai/bitbucket/server/openapi';

const makeCloudRepo = (overrides: Partial<CloudRepository> = {}): BitbucketRepository => ({
    type: 'repository',
    full_name: 'myworkspace/my-repo',
    project: { type: 'project', key: 'PROJ' },
    is_private: false,
    ...overrides,
} as CloudRepository);

const makeServerRepo = (overrides: Partial<ServerRepository> = {}): BitbucketRepository => ({
    slug: 'my-repo',
    project: { key: 'PROJ' },
    archived: false,
    ...overrides,
} as ServerRepository);

const baseConfig: BitbucketConnectionConfig = {
    type: 'bitbucket',
    deploymentType: 'cloud',
};

describe('cloudShouldExcludeRepo', () => {
    test('returns false when no exclusions are configured', () => {
        expect(cloudShouldExcludeRepo(makeCloudRepo(), baseConfig)).toBe(false);
    });

    test('returns false when exclude.repos is empty', () => {
        expect(cloudShouldExcludeRepo(makeCloudRepo(), {
            ...baseConfig,
            exclude: { repos: [] },
        })).toBe(false);
    });

    test('returns true when repo matches exclude.repos exactly', () => {
        expect(cloudShouldExcludeRepo(makeCloudRepo(), {
            ...baseConfig,
            exclude: { repos: ['myworkspace/PROJ/my-repo'] },
        })).toBe(true);
    });

    test('returns false when exclude.repos does not match', () => {
        expect(cloudShouldExcludeRepo(makeCloudRepo(), {
            ...baseConfig,
            exclude: { repos: ['myworkspace/PROJ/other-repo'] },
        })).toBe(false);
    });

    test('returns true when repo matches a glob pattern in exclude.repos', () => {
        expect(cloudShouldExcludeRepo(makeCloudRepo(), {
            ...baseConfig,
            exclude: { repos: ['myworkspace/PROJ/*'] },
        })).toBe(true);
    });

    test('returns true when repo matches a workspace-level glob in exclude.repos', () => {
        expect(cloudShouldExcludeRepo(makeCloudRepo(), {
            ...baseConfig,
            exclude: { repos: ['myworkspace/**'] },
        })).toBe(true);
    });

    test('returns false when exclude.forks is true but repo is not a fork', () => {
        expect(cloudShouldExcludeRepo(makeCloudRepo(), {
            ...baseConfig,
            exclude: { forks: true },
        })).toBe(false);
    });

    test('returns true when exclude.forks is true and repo is a fork', () => {
        const forkedRepo = makeCloudRepo({ parent: { type: 'repository' } as CloudRepository });
        expect(cloudShouldExcludeRepo(forkedRepo, {
            ...baseConfig,
            exclude: { forks: true },
        })).toBe(true);
    });

    test('returns false when exclude.forks is false and repo is a fork', () => {
        const forkedRepo = makeCloudRepo({ parent: { type: 'repository' } as CloudRepository });
        expect(cloudShouldExcludeRepo(forkedRepo, {
            ...baseConfig,
            exclude: { forks: false },
        })).toBe(false);
    });
});

describe('serverShouldExcludeRepo', () => {
    const serverConfig: BitbucketConnectionConfig = {
        type: 'bitbucket',
        deploymentType: 'server',
        url: 'https://bitbucket.example.com',
    };

    test('returns false when no exclusions are configured', () => {
        expect(serverShouldExcludeRepo(makeServerRepo(), serverConfig)).toBe(false);
    });

    test('returns false when exclude.repos is empty', () => {
        expect(serverShouldExcludeRepo(makeServerRepo(), {
            ...serverConfig,
            exclude: { repos: [] },
        })).toBe(false);
    });

    test('returns true when repo matches exclude.repos exactly', () => {
        expect(serverShouldExcludeRepo(makeServerRepo(), {
            ...serverConfig,
            exclude: { repos: ['PROJ/my-repo'] },
        })).toBe(true);
    });

    test('returns false when exclude.repos does not match', () => {
        expect(serverShouldExcludeRepo(makeServerRepo(), {
            ...serverConfig,
            exclude: { repos: ['PROJ/other-repo'] },
        })).toBe(false);
    });

    test('returns true when repo matches a glob pattern in exclude.repos', () => {
        expect(serverShouldExcludeRepo(makeServerRepo(), {
            ...serverConfig,
            exclude: { repos: ['PROJ/*'] },
        })).toBe(true);
    });

    test('returns false when exclude.archived is true but repo is not archived', () => {
        expect(serverShouldExcludeRepo(makeServerRepo({ archived: false }), {
            ...serverConfig,
            exclude: { archived: true },
        })).toBe(false);
    });

    test('returns true when exclude.archived is true and repo is archived', () => {
        expect(serverShouldExcludeRepo(makeServerRepo({ archived: true }), {
            ...serverConfig,
            exclude: { archived: true },
        })).toBe(true);
    });

    test('returns false when exclude.archived is false and repo is archived', () => {
        expect(serverShouldExcludeRepo(makeServerRepo({ archived: true }), {
            ...serverConfig,
            exclude: { archived: false },
        })).toBe(false);
    });

    test('returns false when exclude.forks is true but repo is not a fork', () => {
        expect(serverShouldExcludeRepo(makeServerRepo(), {
            ...serverConfig,
            exclude: { forks: true },
        })).toBe(false);
    });

    test('returns true when exclude.forks is true and repo is a fork', () => {
        const forkedRepo = makeServerRepo({ origin: { slug: 'original-repo' } as ServerRepository });
        expect(serverShouldExcludeRepo(forkedRepo, {
            ...serverConfig,
            exclude: { forks: true },
        })).toBe(true);
    });

    test('returns false when exclude.forks is false and repo is a fork', () => {
        const forkedRepo = makeServerRepo({ origin: { slug: 'original-repo' } as ServerRepository });
        expect(serverShouldExcludeRepo(forkedRepo, {
            ...serverConfig,
            exclude: { forks: false },
        })).toBe(false);
    });
});
