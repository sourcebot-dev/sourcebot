import type { PrismaClient } from "@sourcebot/db";
import type { JobLogger } from "@sourcebot/shared";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    captureException: vi.fn(),
    createBitbucketCloudClient: vi.fn(),
    createBitbucketServerClient: vi.fn(),
    createGitLabFromPersonalAccessToken: vi.fn(),
    createOctokitFromToken: vi.fn(),
    getAuthCredentialsForRepo: vi.fn(),
    getExplicitUserPermissionsForCloudRepo: vi.fn(),
    getProjectMembers: vi.fn(),
    getRepoCollaborators: vi.fn(),
    getUserPermissionsForServerRepo: vi.fn(),
    hasEntitlement: vi.fn(),
}));

vi.mock("@sentry/node", () => ({
    captureException: mocks.captureException,
}));

vi.mock("@sourcebot/shared", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@sourcebot/shared")>()),
    REPO_PERMISSION_SYNC_QUEUE: {
        name: "repo-permission-sync",
        jobOptions: {
            attempts: 2,
            backoff: { type: "exponential", delayMs: 5000 },
            keep: { completed: 50, failed: 50 },
            keepLogs: 500,
        },
    },
}));

vi.mock("../entitlements.js", () => ({
    hasEntitlement: mocks.hasEntitlement,
}));

vi.mock("../utils.js", () => ({
    getAuthCredentialsForRepo: mocks.getAuthCredentialsForRepo,
}));

vi.mock("../github.js", () => ({
    createOctokitFromToken: mocks.createOctokitFromToken,
    getRepoCollaborators: mocks.getRepoCollaborators,
    GITHUB_CLOUD_HOSTNAME: "github.com",
}));

vi.mock("../gitlab.js", () => ({
    createGitLabFromPersonalAccessToken:
        mocks.createGitLabFromPersonalAccessToken,
    getProjectMembers: mocks.getProjectMembers,
}));

vi.mock("../bitbucket.js", () => ({
    createBitbucketCloudClient: mocks.createBitbucketCloudClient,
    createBitbucketServerClient: mocks.createBitbucketServerClient,
    getExplicitUserPermissionsForCloudRepo:
        mocks.getExplicitUserPermissionsForCloudRepo,
    getUserPermissionsForServerRepo: mocks.getUserPermissionsForServerRepo,
}));

import { createRepoPermissionSyncWorkload } from "./repoPermissionSyncWorkload.js";

const repo = {
    id: 42,
    name: "github.com/sourcebot-dev/sourcebot",
    displayName: "sourcebot-dev/sourcebot",
    external_codeHostType: "github",
    external_id: "123",
    metadata: {},
    connections: [],
};
const repoFindUniqueOrThrow = vi.fn().mockResolvedValue(repo);
const repoUpdate = vi.fn().mockResolvedValue(repo);
const accountFindMany = vi.fn().mockResolvedValue([]);
const permissionCreateMany = vi.fn().mockResolvedValue({ count: 0 });
const permissionSyncJobUpsert = vi.fn();
const permissionSyncJobUpdate = vi.fn().mockResolvedValue({ repo });
const transaction = vi.fn((queries: Array<Promise<unknown>>) =>
    Promise.all(queries),
);

const db = {
    repo: {
        findUniqueOrThrow: repoFindUniqueOrThrow,
        update: repoUpdate,
    },
    account: {
        findMany: accountFindMany,
    },
    accountToRepoPermission: {
        createMany: permissionCreateMany,
    },
    repoPermissionSyncJob: {
        upsert: permissionSyncJobUpsert,
        update: permissionSyncJobUpdate,
    },
    $transaction: transaction,
} as unknown as PrismaClient;

const jobLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: vi.fn(),
} satisfies JobLogger;

const createWorkload = () =>
    createRepoPermissionSyncWorkload({
        db,
        settings: {
            maxRepoPermissionSyncJobConcurrency: 3,
        } as never,
    });

const lifecycleContext = {
    data: {
        repoId: 42,
    },
    jobId: "job_1",
    attemptsMade: 0,
    maxAttempts: 2,
    prisma: db,
    logger: jobLogger,
};

const processContext = {
    ...lifecycleContext,
    signal: new AbortController().signal,
    updateProgress: vi.fn(),
    trigger: vi.fn(),
};

beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasEntitlement.mockResolvedValue(true);
    mocks.getAuthCredentialsForRepo.mockReset().mockResolvedValue({
        hostUrl: "https://github.com",
        token: "token",
    });
    mocks.createOctokitFromToken.mockReset().mockResolvedValue({ octokit: {} });
    mocks.getRepoCollaborators.mockReset().mockResolvedValue([]);
    repoFindUniqueOrThrow.mockResolvedValue(repo);
    permissionSyncJobUpdate.mockResolvedValue({ repo });
    accountFindMany.mockResolvedValue([]);
    repoUpdate.mockResolvedValue(repo);
    permissionCreateMany.mockResolvedValue({ count: 0 });
});

describe("repoPermissionSyncWorkload", () => {
    test("uses the configured concurrency and database-backed lifecycle hooks", () => {
        const workload = createWorkload();

        expect(workload.queueSpec.name).toBe("repo-permission-sync");
        expect(workload.concurrency).toBe(3);
        expect(workload.onStarted).toBeTypeOf("function");
        expect(workload.onCompleted).toBeTypeOf("function");
        expect(workload.onTerminalFailure).toBeTypeOf("function");
    });

    test("syncs the requested repo with its connections", async () => {
        await createWorkload().process(processContext);

        expect(repoFindUniqueOrThrow).toHaveBeenCalledWith({
            where: { id: 42 },
            include: {
                connections: {
                    include: {
                        connection: true,
                    },
                },
            },
        });
        expect(mocks.getAuthCredentialsForRepo).toHaveBeenCalledWith(
            repo,
            jobLogger,
        );
        expect(mocks.createOctokitFromToken).toHaveBeenCalledWith({
            token: "token",
            url: undefined,
        });
        expect(transaction).toHaveBeenCalledOnce();
    });

    test("does not run without the permission syncing entitlement", async () => {
        mocks.hasEntitlement.mockResolvedValue(false);

        await expect(createWorkload().process(processContext)).rejects.toThrow(
            "Permission syncing entitlement is not currently available.",
        );

        expect(repoFindUniqueOrThrow).not.toHaveBeenCalled();
    });

    test("replaces all permissions for a complete GitHub sync", async () => {
        const githubRepo = {
            ...repo,
            external_codeHostType: "github",
            external_id: "123",
            metadata: {},
        };
        repoFindUniqueOrThrow.mockResolvedValue(githubRepo);
        mocks.getAuthCredentialsForRepo.mockResolvedValue({
            hostUrl: "https://github.com",
            token: "token",
        });
        const octokit = {};
        mocks.createOctokitFromToken.mockResolvedValue({ octokit });
        mocks.getRepoCollaborators.mockResolvedValue([{ id: 101 }]);
        accountFindMany.mockResolvedValue([{ id: "account_1" }]);

        await createWorkload().process(processContext);

        expect(accountFindMany).toHaveBeenCalledWith({
            where: {
                providerType: "github",
                providerAccountId: {
                    in: ["101"],
                },
                issuerUrl: "https://github.com",
            },
        });
        expect(repoUpdate).toHaveBeenCalledWith({
            where: { id: 42 },
            data: {
                permittedAccounts: {
                    deleteMany: {},
                },
            },
        });
        expect(permissionCreateMany).toHaveBeenCalledWith({
            data: [
                {
                    accountId: "account_1",
                    repoId: 42,
                    source: "REPO_DRIVEN",
                },
            ],
            skipDuplicates: true,
        });
        expect(transaction).toHaveBeenCalledOnce();
    });

    test("preserves account-driven permissions for a partial Bitbucket Cloud sync", async () => {
        const bitbucketRepo = {
            ...repo,
            external_codeHostType: "bitbucketCloud",
            external_id: "repo-uuid",
            metadata: {
                codeHostMetadata: {
                    bitbucketCloud: {
                        workspace: "sourcebot",
                        repoSlug: "sourcebot",
                    },
                },
            },
        };
        repoFindUniqueOrThrow.mockResolvedValue(bitbucketRepo);
        mocks.getAuthCredentialsForRepo.mockResolvedValue({
            hostUrl: "https://bitbucket.org",
            token: "token",
            connectionConfig: {
                user: "service-account",
            },
        });
        mocks.createBitbucketCloudClient.mockReturnValue({});
        mocks.getExplicitUserPermissionsForCloudRepo.mockResolvedValue([
            { accountId: "upstream-account" },
        ]);
        accountFindMany.mockResolvedValue([{ id: "account_1" }]);

        await createWorkload().process(processContext);

        expect(repoUpdate).toHaveBeenCalledWith({
            where: { id: 42 },
            data: {
                permittedAccounts: {
                    deleteMany: {
                        source: "REPO_DRIVEN",
                    },
                },
            },
        });
        expect(permissionCreateMany).toHaveBeenCalledWith({
            data: [
                {
                    accountId: "account_1",
                    repoId: 42,
                    source: "REPO_DRIVEN",
                },
            ],
            skipDuplicates: true,
        });
    });

    test("marks a job as in progress when started", async () => {
        await createWorkload().onStarted?.(lifecycleContext);

        expect(permissionSyncJobUpsert).toHaveBeenCalledWith({
            where: { id: "job_1" },
            update: {
                status: "IN_PROGRESS",
                completedAt: null,
                errorMessage: null,
            },
            create: {
                id: "job_1",
                repoId: 42,
                status: "IN_PROGRESS",
            },
        });
    });

    test("marks a job completed and updates the repo sync timestamp", async () => {
        await createWorkload().onCompleted?.(lifecycleContext, undefined);

        expect(permissionSyncJobUpdate).toHaveBeenCalledWith({
            where: { id: "job_1" },
            data: {
                status: "COMPLETED",
                completedAt: expect.any(Date),
                errorMessage: null,
                repo: {
                    update: {
                        permissionSyncedAt: expect.any(Date),
                    },
                },
            },
            select: {
                repo: true,
            },
        });
    });

    test("marks a job failed after terminal failure", async () => {
        const error = new Error("Upstream unavailable");

        await createWorkload().onTerminalFailure?.(lifecycleContext, error);

        expect(permissionSyncJobUpdate).toHaveBeenCalledWith({
            where: { id: "job_1" },
            data: {
                status: "FAILED",
                completedAt: expect.any(Date),
                errorMessage: "Upstream unavailable",
            },
            select: {
                repo: true,
            },
        });
        expect(mocks.captureException).toHaveBeenCalledWith(error, {
            tags: {
                jobId: "job_1",
                queue: "repo-permission-sync",
            },
        });
    });
});
