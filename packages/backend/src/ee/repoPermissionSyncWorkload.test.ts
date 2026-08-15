import type { PrismaClient } from "@sourcebot/db";
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
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
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
            keepJobs: {
                completed: { count: 50 },
                failed: { count: 50 },
            },
            keepLogs: 500,
        },
    },
    createLogger: vi.fn(() => mocks.logger),
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
const repoUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
const accountFindMany = vi.fn().mockResolvedValue([]);
const permissionCreateMany = vi.fn().mockResolvedValue({ count: 0 });
const permissionSyncJobUpsert = vi.fn();
const permissionSyncJobUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
const transactionClient = {
    repo: {
        update: repoUpdate,
        updateMany: repoUpdateMany,
    },
    repoPermissionSyncJob: {
        upsert: permissionSyncJobUpsert,
        updateMany: permissionSyncJobUpdateMany,
    },
};
const transaction = vi.fn(
    (
        queriesOrCallback:
            | Array<Promise<unknown>>
            | ((tx: typeof transactionClient) => Promise<unknown>),
    ) =>
        typeof queriesOrCallback === "function"
            ? queriesOrCallback(transactionClient)
            : Promise.all(queriesOrCallback),
);

const db = {
    repo: {
        findUniqueOrThrow: repoFindUniqueOrThrow,
        update: repoUpdate,
        updateMany: repoUpdateMany,
    },
    account: {
        findMany: accountFindMany,
    },
    accountToRepoPermission: {
        createMany: permissionCreateMany,
    },
    repoPermissionSyncJob: {
        upsert: permissionSyncJobUpsert,
        updateMany: permissionSyncJobUpdateMany,
    },
    $transaction: transaction,
} as unknown as PrismaClient;

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
    permissionSyncJobUpdateMany.mockResolvedValue({ count: 1 });
    accountFindMany.mockResolvedValue([]);
    repoUpdate.mockResolvedValue(repo);
    repoUpdateMany.mockResolvedValue({ count: 1 });
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

    test("uses a dedicated per-repo permission sync lock", () => {
        const workload = createWorkload();

        expect(workload.executionLock).toBeDefined();
        expect(workload.executionLock?.resource({ repoId: 42 })).toBe(
            "sourcebot:lock:repo-permission-sync:42",
        );
        expect(workload.executionLock?.durationMs).toBe(60_000);
    });

    test("does not start syncing when execution has already been aborted", async () => {
        const controller = new AbortController();
        controller.abort(new Error("Repository execution lock was lost"));

        await expect(
            createWorkload().process({
                ...processContext,
                signal: controller.signal,
            }),
        ).rejects.toThrow("Repository execution lock was lost");
        expect(mocks.hasEntitlement).not.toHaveBeenCalled();
        expect(repoFindUniqueOrThrow).not.toHaveBeenCalled();
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
            mocks.logger,
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
        expect(repoUpdate).toHaveBeenCalledWith({
            where: { id: 42 },
            data: { latestPermissionSyncJobId: "job_1" },
        });
        expect(transaction).toHaveBeenCalledOnce();
    });

    test("marks a job completed and updates the repo sync timestamp when it is still latest", async () => {
        await createWorkload().onCompleted?.(lifecycleContext, {
            repoName: "sourcebot-dev/sourcebot",
        });

        expect(permissionSyncJobUpdateMany).toHaveBeenCalledWith({
            where: { id: "job_1" },
            data: {
                status: "COMPLETED",
                completedAt: expect.any(Date),
                errorMessage: null,
            },
        });
        expect(repoUpdateMany).toHaveBeenCalledWith({
            where: {
                id: 42,
                latestPermissionSyncJobId: "job_1",
            },
            data: {
                permissionSyncedAt: expect.any(Date),
            },
        });
        expect(transaction).toHaveBeenCalledOnce();
    });

    test("does not fail completion after the repo has been deleted", async () => {
        permissionSyncJobUpdateMany.mockResolvedValue({ count: 0 });
        repoUpdateMany.mockResolvedValue({ count: 0 });

        await expect(
            createWorkload().onCompleted?.(lifecycleContext, {
                repoName: "sourcebot-dev/sourcebot",
            }),
        ).resolves.toBeUndefined();
    });

    test("marks a job failed after terminal failure", async () => {
        const error = new Error("Upstream unavailable");

        await createWorkload().onTerminalFailure?.(lifecycleContext, error);

        expect(permissionSyncJobUpdateMany).toHaveBeenCalledWith({
            where: { id: "job_1" },
            data: {
                status: "FAILED",
                completedAt: expect.any(Date),
                errorMessage: "Upstream unavailable",
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
