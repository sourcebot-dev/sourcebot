import type { GiteaConnectionConfig } from '@sourcebot/schemas/v3/gitea.type';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const notFound = Object.assign(new Error("Not Found"), { status: 404 });

    return {
        userListRepos: vi.fn(async () => {
            throw notFound;
        }),
        orgListRepos: vi.fn(async () => {
            throw notFound;
        }),
        repoGet: vi.fn(async () => {
            throw notFound;
        }),
    };
});

vi.mock("@sentry/node", () => ({
    captureException: vi.fn(),
}));

vi.mock("gitea-js", () => ({
    giteaApi: () => ({
        users: {
            userListRepos: mocks.userListRepos,
        },
        orgs: {
            orgListRepos: mocks.orgListRepos,
        },
        repos: {
            repoGet: mocks.repoGet,
        },
    }),
}));

vi.mock("./utils.js", () => ({
    measure: async (routine: () => Promise<unknown>) => ({
        durationMs: 1,
        data: await routine(),
    }),
}));

import { getGiteaReposFromConfig } from './gitea';
import { collectRepositoryDiscoveryIssues } from './repositoryDiscoveryIssueContext.js';

beforeEach(() => {
    vi.clearAllMocks();
});

describe("Gitea repository discovery", () => {
    test("reports inaccessible configured targets as partial successes", async () => {
        const config = {
            type: "gitea",
            orgs: ["missing-org"],
            repos: ["missing-owner/missing-repo"],
            users: ["missing-user"],
        } satisfies GiteaConnectionConfig;

        const result = await collectRepositoryDiscoveryIssues(() =>
            getGiteaReposFromConfig(config)
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
                    message: "Gitea organization was not found or is inaccessible.",
                },
                {
                    code: "NOT_FOUND_OR_INACCESSIBLE",
                    effect: "TARGET_SKIPPED",
                    subject: {
                        kind: "repository",
                        value: "missing-owner/missing-repo",
                    },
                    message: "Gitea repository was not found or is inaccessible.",
                },
                {
                    code: "NOT_FOUND_OR_INACCESSIBLE",
                    effect: "TARGET_SKIPPED",
                    subject: {
                        kind: "user",
                        value: "missing-user",
                    },
                    message: "Gitea user was not found or is inaccessible.",
                },
            ],
        });
    });

    test("reports malformed repositories returned by Gitea", async () => {
        mocks.orgListRepos.mockResolvedValueOnce({
            data: [null, { id: 123 }],
            headers: new Headers({ "x-total-count": "2" }),
        } as never);

        const result = await collectRepositoryDiscoveryIssues(() =>
            getGiteaReposFromConfig({
                type: "gitea",
                orgs: ["my-org"],
            })
        );

        expect(result).toEqual({
            value: [],
            issues: [
                {
                    code: "INVALID_PROVIDER_RESPONSE",
                    effect: "DISCOVERY_INCOMPLETE",
                    message: "Gitea returned a null repository, so it was skipped.",
                },
                {
                    code: "INVALID_PROVIDER_RESPONSE",
                    effect: "DISCOVERY_INCOMPLETE",
                    subject: {
                        kind: "repository",
                        value: "123",
                    },
                    message: "Gitea returned a repository without a full name, so it was skipped.",
                },
            ],
        });
    });
});
