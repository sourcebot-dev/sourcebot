import type { GithubConnectionConfig } from "@sourcebot/schemas/v3/github.type";
import { expect, test, describe, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const notFound = Object.assign(new Error("Not Found"), { status: 404 });

    return {
        reposGet: vi.fn(async () => {
            throw notFound;
        }),
        paginateIterator: vi.fn(() => ({
            async *[Symbol.asyncIterator]() {
                throw notFound;
            },
        })),
    };
});

vi.mock("@sentry/node", () => ({
    captureException: vi.fn(),
}));

vi.mock("@octokit/rest", () => ({
    Octokit: class {
        repos = {
            get: mocks.reposGet,
            listForOrg: vi.fn(),
        };
        rest = {
            search: {
                repos: vi.fn(),
            },
            users: {
                getAuthenticated: vi.fn(),
            },
        };
        paginate = {
            iterator: mocks.paginateIterator,
        };
    },
}));

vi.mock("./ee/githubAppManager.js", () => ({
    GithubAppManager: {
        getInstance: () => ({
            ensureInitialized: vi.fn(),
            appsConfigured: () => false,
        }),
    },
}));

vi.mock("./utils.js", () => ({
    fetchWithRetry: (routine: () => Promise<unknown>) => routine(),
    measure: async (routine: () => Promise<unknown>) => ({
        durationMs: 1,
        data: await routine(),
    }),
}));

import { collectRepositoryDiscoveryIssues } from "./repositoryDiscoveryIssueContext.js";
import {
    OctokitRepository,
    shouldExcludeRepo,
    detectGitHubTokenType,
    supportsOAuthScopeIntrospection,
    getGitHubReposFromConfig,
} from './github';

describe("GitHub repository discovery", () => {
    test("reports inaccessible configured targets as partial successes", async () => {
        const config = {
            type: "github",
            url: "https://github.example.com",
            orgs: ["missing-org"],
            repos: ["missing-owner/missing-repo"],
            users: ["missing-user"],
        } satisfies GithubConnectionConfig;
        const result = await collectRepositoryDiscoveryIssues(() =>
            getGitHubReposFromConfig(
                config,
                new AbortController().signal,
            )
        );

        expect(result).toEqual({
            value: [],
            issues: [
                {
                    code: "NOT_FOUND_OR_INACCESSIBLE",
                    effect: "TARGET_SKIPPED",
                    subject: {
                        kind: "organization",
                        value: "missing-org",
                    },
                    message: "GitHub organization was not found or is inaccessible.",
                },
                {
                    code: "NOT_FOUND_OR_INACCESSIBLE",
                    effect: "TARGET_SKIPPED",
                    subject: {
                        kind: "repository",
                        value: "missing-owner/missing-repo",
                    },
                    message: "GitHub repository was not found or is inaccessible.",
                },
                {
                    code: "NOT_FOUND_OR_INACCESSIBLE",
                    effect: "TARGET_SKIPPED",
                    subject: {
                        kind: "user",
                        value: "missing-user",
                    },
                    message: "GitHub user was not found or is inaccessible.",
                },
            ],
        });
    });
});

describe('detectGitHubTokenType', () => {
    test('detects classic PAT (ghp_)', () => {
        expect(detectGitHubTokenType('ghp_abc123def456')).toBe('classic_pat');
    });

    test('detects OAuth app user token (gho_)', () => {
        expect(detectGitHubTokenType('gho_abc123def456')).toBe('oauth_user');
    });

    test('detects GitHub App user token (ghu_)', () => {
        expect(detectGitHubTokenType('ghu_abc123def456')).toBe('app_user');
    });

    test('detects GitHub App installation token (ghs_)', () => {
        expect(detectGitHubTokenType('ghs_abc123def456')).toBe('app_installation');
    });

    test('detects fine-grained PAT (github_pat_)', () => {
        expect(detectGitHubTokenType('github_pat_abc123def456')).toBe('fine_grained_pat');
    });

    test('returns unknown for unrecognized token format', () => {
        expect(detectGitHubTokenType('some_random_token')).toBe('unknown');
        expect(detectGitHubTokenType('')).toBe('unknown');
        expect(detectGitHubTokenType('v1.abc123')).toBe('unknown');
    });
});

describe('supportsOAuthScopeIntrospection', () => {
    test('returns true for classic PAT', () => {
        expect(supportsOAuthScopeIntrospection('classic_pat')).toBe(true);
    });

    test('returns true for OAuth app user token', () => {
        expect(supportsOAuthScopeIntrospection('oauth_user')).toBe(true);
    });

    test('returns false for GitHub App user token', () => {
        expect(supportsOAuthScopeIntrospection('app_user')).toBe(false);
    });

    test('returns false for GitHub App installation token', () => {
        expect(supportsOAuthScopeIntrospection('app_installation')).toBe(false);
    });

    test('returns false for fine-grained PAT', () => {
        expect(supportsOAuthScopeIntrospection('fine_grained_pat')).toBe(false);
    });

    test('returns false for unknown token type', () => {
        expect(supportsOAuthScopeIntrospection('unknown')).toBe(false);
    });
});

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

test('shouldExcludeRepo handles private repos correctly', () => {
    const privateRepo = {
        full_name: 'test/private-repo',
        clone_url: 'https://github.com/test/private-repo.git',
        private: true,
        visibility: 'private',
    } as OctokitRepository;

    expect(shouldExcludeRepo({ repo: privateRepo })).toBe(false);
    expect(shouldExcludeRepo({ repo: privateRepo, exclude: { private: true } })).toBe(true);
    expect(shouldExcludeRepo({ repo: privateRepo, exclude: { private: false } })).toBe(false);
});

test('shouldExcludeRepo does not exclude internal repos when exclude.private is true', () => {
    const internalRepo = {
        full_name: 'test/internal-repo',
        clone_url: 'https://github.com/test/internal-repo.git',
        private: true,
        visibility: 'internal',
    } as OctokitRepository;

    expect(shouldExcludeRepo({ repo: internalRepo, exclude: { private: true } })).toBe(false);
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
