import type { AzureDevOpsConnectionConfig } from '@sourcebot/schemas/v3/azuredevops.type';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getProjects: vi.fn(),
    getRepositories: vi.fn(),
    getRepository: vi.fn(),
}));

vi.mock("@sentry/node", () => ({
    captureException: vi.fn(),
}));

vi.mock("@sourcebot/shared", async (importOriginal) => ({
    ...await importOriginal<typeof import("@sourcebot/shared")>(),
    getTokenFromConfig: vi.fn(async () => "token"),
}));

vi.mock("azure-devops-node-api", () => ({
    getPersonalAccessTokenHandler: vi.fn(() => ({})),
    WebApi: class {
        getCoreApi = vi.fn(async () => ({
            getProjects: mocks.getProjects,
        }));
        getGitApi = vi.fn(async () => ({
            getRepositories: mocks.getRepositories,
            getRepository: mocks.getRepository,
        }));
    },
}));

vi.mock("./utils.js", () => ({
    fetchWithRetry: (routine: () => Promise<unknown>) => routine(),
    measure: async (routine: () => Promise<unknown>) => ({
        durationMs: 1,
        data: await routine(),
    }),
}));

import { getAzureDevOpsReposFromConfig } from './azuredevops';
import { collectRepositoryDiscoveryIssues } from './repositoryDiscoveryIssueContext.js';

const config = (overrides: Partial<AzureDevOpsConnectionConfig>): AzureDevOpsConnectionConfig => ({
    type: "azuredevops",
    deploymentType: "cloud",
    token: { env: "AZURE_DEVOPS_TOKEN" },
    ...overrides,
});

beforeEach(() => {
    vi.clearAllMocks();
    const notFound = Object.assign(new Error("Not Found"), { statusCode: 404 });
    mocks.getProjects.mockRejectedValue(notFound);
    mocks.getRepositories.mockRejectedValue(notFound);
    mocks.getRepository.mockRejectedValue(notFound);
});

describe("Azure DevOps repository discovery", () => {
    test("reports inaccessible configured targets as partial successes", async () => {
        const result = await collectRepositoryDiscoveryIssues(() =>
            getAzureDevOpsReposFromConfig(config({
                orgs: ["missing-org"],
                projects: ["org/missing-project"],
                repos: ["org/project/missing-repo"],
            }))
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
                    message: "Azure DevOps organization was not found or is inaccessible.",
                },
                {
                    code: "NOT_FOUND_OR_INACCESSIBLE",
                    effect: "TARGET_SKIPPED",
                    subject: {
                        kind: "project",
                        value: "org/missing-project",
                    },
                    message: "Azure DevOps project was not found or is inaccessible.",
                },
                {
                    code: "NOT_FOUND_OR_INACCESSIBLE",
                    effect: "TARGET_SKIPPED",
                    subject: {
                        kind: "repository",
                        value: "org/project/missing-repo",
                    },
                    message: "Azure DevOps repository was not found or is inaccessible.",
                },
            ],
        });
    });

    test("reports incomplete project enumeration within an organization", async () => {
        mocks.getProjects.mockResolvedValue([
            { name: "missing-id" },
            { id: "broken-project-id", name: "broken-project" },
        ]);
        mocks.getRepositories.mockRejectedValue(new Error("Service unavailable"));

        const result = await collectRepositoryDiscoveryIssues(() =>
            getAzureDevOpsReposFromConfig(config({ orgs: ["my-org"] }))
        );

        expect(result).toEqual({
            value: [],
            issues: [
                {
                    code: "INVALID_PROVIDER_RESPONSE",
                    effect: "DISCOVERY_INCOMPLETE",
                    subject: {
                        kind: "project",
                        value: "my-org/missing-id",
                    },
                    message: "Azure DevOps returned a project without an ID, so its repositories were skipped.",
                },
                {
                    code: "ENUMERATION_FAILED",
                    effect: "DISCOVERY_INCOMPLETE",
                    subject: {
                        kind: "project",
                        value: "my-org/broken-project",
                    },
                    message: "Azure DevOps repository enumeration did not complete for this project.",
                },
            ],
        });
    });
});
