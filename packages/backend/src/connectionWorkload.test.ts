import type { PrismaClient } from "@sourcebot/db";
import type { RepoData } from "./repoCompileUtils.js";
import type { JobManager, ProcessContext } from "./types.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    connectionFindUniqueOrThrow: vi.fn(),
    connectionUpdate: vi.fn(),
    connectionSyncJobUpsert: vi.fn(),
    connectionSyncJobUpdate: vi.fn(),
    compileGithubConfig: vi.fn(),
    loadConfig: vi.fn(),
    syncSearchContexts: vi.fn(),
    repoFindMany: vi.fn(),
    repoUpsert: vi.fn(),
    repoToConnectionDeleteMany: vi.fn(),
    getJobSchedulerIds: vi.fn(),
    upsertJobScheduler: vi.fn(),
    removeJobScheduler: vi.fn(),
}));

vi.mock("@sentry/node", () => ({
    captureException: vi.fn(),
}));

vi.mock("@sourcebot/shared", () => ({
    CONNECTION_QUEUE: {
        name: "connection-sync",
        dedupKey: ({ connectionId }: { connectionId: number }) =>
            `connection:${connectionId}`,
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
    JOB_PRIORITIES: {
        INITIAL: 5,
        SCHEDULED: 10,
    },
    env: {
        CONFIG_PATH: "/config.json",
        CONNECTION_MANAGER_UPSERT_TIMEOUT_MS: 60_000,
    },
    PERMISSION_SYNC_SUPPORTED_CODE_HOST_TYPES: [
        "github",
        "gitlab",
        "bitbucketCloud",
        "bitbucketServer",
    ],
    PERMISSION_SYNC_SUPPORTED_IDENTITY_PROVIDERS: [
        "github",
        "gitlab",
        "bitbucket-cloud",
        "bitbucket-server",
    ],
    loadConfig: mocks.loadConfig,
}));

vi.mock("./repoCompileUtils.js", () => ({
    compileAzureDevOpsConfig: vi.fn(),
    compileBitbucketConfig: vi.fn(),
    compileGenericGitHostConfig: vi.fn(),
    compileGerritConfig: vi.fn(),
    compileGiteaConfig: vi.fn(),
    compileGithubConfig: mocks.compileGithubConfig,
    compileGitlabConfig: vi.fn(),
}));

vi.mock("./ee/syncSearchContexts.js", () => ({
    syncSearchContexts: mocks.syncSearchContexts,
}));

import {
    createConnectionWorkload,
    persistConnectionRepositories,
    reconcileRepoIndexWork,
    reconcileRepoPermissionSyncWork,
} from "./connectionWorkload.js";
import { REPO_PERMISSION_SYNC_WHERE } from "./ee/permissionSyncEligibility.js";

const transactionClient = {
    connection: {
        update: mocks.connectionUpdate,
    },
    connectionSyncJob: {
        upsert: mocks.connectionSyncJobUpsert,
    },
};
const transaction = vi.fn(
    (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
);

const db = {
    connection: {
        findUniqueOrThrow: mocks.connectionFindUniqueOrThrow,
        update: mocks.connectionUpdate,
    },
    connectionSyncJob: {
        upsert: mocks.connectionSyncJobUpsert,
        update: mocks.connectionSyncJobUpdate,
    },
    repo: {
        findMany: mocks.repoFindMany,
        upsert: mocks.repoUpsert,
    },
    repoToConnection: {
        deleteMany: mocks.repoToConnectionDeleteMany,
    },
    $transaction: transaction,
} as unknown as PrismaClient;

const jobManager = {
    getJobSchedulerIds: mocks.getJobSchedulerIds,
    upsertJobScheduler: mocks.upsertJobScheduler,
    removeJobScheduler: mocks.removeJobScheduler,
} as unknown as JobManager;
const connectionWorkload = createConnectionWorkload({
    db,
    jobManager,
    permissionSyncEnabled: true,
    settings: {
        maxConnectionSyncJobConcurrency: 2,
        reindexIntervalMs: 3_600_000,
        repoDrivenPermissionSyncIntervalMs: 21_600_000,
    } as never,
});

const data = {
    connectionId: 42,
};

const lifecycleLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
};

const lifecycleContext = {
    data,
    jobId: "job-1",
    attemptsMade: 0,
    maxAttempts: 2,
    prisma: db,
    logger: lifecycleLogger,
};

describe("connectionWorkload", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        mocks.connectionUpdate.mockResolvedValue({});
        mocks.repoFindMany.mockResolvedValue([]);
        mocks.getJobSchedulerIds.mockResolvedValue([]);
        mocks.upsertJobScheduler.mockResolvedValue("scheduled-job");
        mocks.removeJobScheduler.mockResolvedValue(true);
        mocks.loadConfig.mockResolvedValue({ contexts: undefined });
        mocks.syncSearchContexts.mockResolvedValue(undefined);
    });

    test("declares database-backed lifecycle hooks", () => {
        expect(connectionWorkload.onStarted).toBeTypeOf("function");
        expect(connectionWorkload.onCompleted).toBeTypeOf("function");
        expect(connectionWorkload.onTerminalFailure).toBeTypeOf("function");
    });

    test("uses a distinct execution lock for each connection", () => {
        expect(connectionWorkload.executionLock).toBeDefined();
        expect(
            connectionWorkload.executionLock?.resource({ connectionId: 42 }),
        ).toBe("sourcebot:lock:connection:42");
        expect(
            connectionWorkload.executionLock?.resource({ connectionId: 43 }),
        ).toBe("sourcebot:lock:connection:43");
        expect(connectionWorkload.executionLock?.durationMs).toBe(60_000);
    });

    test("does not start syncing when execution has already been aborted", async () => {
        const controller = new AbortController();
        controller.abort(new Error("Connection execution lock was lost"));

        await expect(
            connectionWorkload.process({
                ...lifecycleContext,
                signal: controller.signal,
                updateProgress: vi.fn(),
                trigger: vi.fn(),
            }),
        ).rejects.toThrow("Connection execution lock was lost");
        expect(mocks.connectionFindUniqueOrThrow).not.toHaveBeenCalled();
    });

    test("marks the connection sync job as in progress when started", async () => {
        await connectionWorkload.onStarted?.(lifecycleContext);

        expect(mocks.connectionSyncJobUpsert).toHaveBeenCalledWith({
            where: {
                id: "job-1",
            },
            update: {
                status: "IN_PROGRESS",
                completedAt: null,
                errorMessage: null,
                warningMessages: [],
            },
            create: {
                id: "job-1",
                connectionId: 42,
                status: "IN_PROGRESS",
                warningMessages: [],
            },
        });
        expect(mocks.connectionUpdate).toHaveBeenCalledWith({
            where: {
                id: 42,
            },
            data: {
                latestSyncJobId: "job-1",
            },
        });
        expect(transaction).toHaveBeenCalledOnce();
    });

    test("marks the connection sync job as completed", async () => {
        await connectionWorkload.onCompleted?.(lifecycleContext, {
            reposToCleanup: [],
            reposToIndex: [],
        });

        expect(mocks.connectionSyncJobUpdate).toHaveBeenCalledWith({
            where: {
                id: "job-1",
            },
            data: {
                status: "COMPLETED",
                completedAt: expect.any(Date),
                errorMessage: null,
            },
        });
    });

    test("marks the connection sync job as failed after terminal failure", async () => {
        await connectionWorkload.onTerminalFailure?.(
            lifecycleContext,
            new Error("Connection credentials expired"),
        );

        expect(mocks.connectionSyncJobUpdate).toHaveBeenCalledWith({
            where: {
                id: "job-1",
            },
            data: {
                status: "FAILED",
                completedAt: expect.any(Date),
                errorMessage: "Connection credentials expired",
            },
        });
    });

    test("orchestrates discovery, persistence, and repo work reconciliation", async () => {
        const config = {
            type: "github" as const,
        };
        const discoveredRepo = {
            external_id: "repo-4",
            external_codeHostUrl: "https://github.com",
        };
        mocks.connectionFindUniqueOrThrow.mockResolvedValue({
            id: 42,
            name: "github",
            orgId: 7,
            config,
        });
        mocks.compileGithubConfig.mockResolvedValue({
            repoData: [discoveredRepo],
            warnings: ["Repository was archived"],
        });
        mocks.repoUpsert.mockResolvedValue({
            id: 4,
            name: "github.com/sourcebot/repo-4",
            indexedAt: null,
        });
        const trigger = vi.fn();
        const updateProgress = vi.fn();

        const result = await connectionWorkload.process({
            ...lifecycleContext,
            signal: new AbortController().signal,
            updateProgress,
            trigger,
        });

        expect(mocks.compileGithubConfig).toHaveBeenCalledWith(
            config,
            42,
            expect.any(AbortSignal),
        );
        expect(mocks.connectionSyncJobUpdate).toHaveBeenCalledWith({
            where: { id: "job-1" },
            data: { warningMessages: ["Repository was archived"] },
        });
        expect(mocks.repoUpsert).toHaveBeenCalledOnce();
        expect(mocks.upsertJobScheduler).toHaveBeenCalledWith(
            "repo-index",
            "repo-index-v1-4",
            3_600_000,
            { repoId: 4, type: "INDEX" },
            { priority: 10 },
        );
        expect(trigger).toHaveBeenCalledWith(
            "repo-index",
            {
                repoId: 4,
                type: "INDEX",
            },
            { priority: 5 },
        );
        expect(mocks.connectionUpdate).toHaveBeenCalledWith({
            where: { id: 42 },
            data: { syncedAt: expect.any(Date) },
        });
        expect(mocks.syncSearchContexts).toHaveBeenCalledWith({
            orgId: 7,
            contexts: undefined,
        });
        expect(result).toEqual({
            reposToCleanup: [],
            reposToIndex: [
                { id: 4, name: "github.com/sourcebot/repo-4" },
            ],
        });
        expect(updateProgress).not.toHaveBeenCalled();
    });

    test("does not mark the connection synced when repo work reconciliation fails", async () => {
        mocks.connectionFindUniqueOrThrow.mockResolvedValue({
            id: 42,
            name: "github",
            orgId: 7,
            config: { type: "github" },
        });
        mocks.compileGithubConfig.mockResolvedValue({
            repoData: [
                {
                    external_id: "repo-4",
                    external_codeHostUrl: "https://github.com",
                },
            ],
            warnings: [],
        });
        mocks.repoUpsert.mockResolvedValue({
            id: 4,
            name: "github.com/sourcebot/repo-4",
            indexedAt: null,
        });
        mocks.upsertJobScheduler.mockRejectedValueOnce(
            new Error("Redis unavailable"),
        );

        await expect(
            connectionWorkload.process({
                ...lifecycleContext,
                signal: new AbortController().signal,
                updateProgress: vi.fn(),
                trigger: vi.fn(),
            }),
        ).rejects.toThrow("Redis unavailable");

        expect(mocks.connectionUpdate).not.toHaveBeenCalled();
        expect(mocks.syncSearchContexts).not.toHaveBeenCalled();
    });
});

describe("connectionWorkload repo sync helpers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getJobSchedulerIds.mockResolvedValue([]);
        mocks.upsertJobScheduler.mockResolvedValue("scheduled-job");
        mocks.removeJobScheduler.mockResolvedValue(true);
    });

    test("persists the discovered repository snapshot", async () => {
        const indexedAt = new Date("2026-07-30T12:00:00.000Z");
        const existingRepo = {
            external_id: "repo-1",
            external_codeHostUrl: "https://github.com",
            displayName: "sourcebot/repo-1",
            connections: {
                create: {
                    connectionId: 42,
                },
            },
        };
        const newRepo = {
            external_id: "repo-4",
            external_codeHostUrl: "https://github.com",
            displayName: "sourcebot/repo-4",
            connections: {
                create: {
                    connectionId: 42,
                },
            },
        };
        mocks.repoFindMany
            .mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }])
            .mockResolvedValueOnce([
                { id: 2, name: "github.com/sourcebot/repo-2" },
            ]);
        mocks.repoUpsert
            .mockResolvedValueOnce({
                id: 1,
                name: "github.com/sourcebot/repo-1",
                indexedAt,
            })
            .mockResolvedValueOnce({
                id: 4,
                name: "github.com/sourcebot/repo-4",
                indexedAt: null,
            });

        const result = await persistConnectionRepositories({
            db,
            connectionId: 42,
            orgId: 7,
            discoveredRepos: [
                existingRepo,
                newRepo,
                newRepo,
            ] as unknown as RepoData[],
        });

        expect(mocks.repoUpsert).toHaveBeenCalledTimes(2);
        expect(mocks.repoUpsert).toHaveBeenNthCalledWith(1, {
            where: {
                external_id_external_codeHostUrl_orgId: {
                    external_id: "repo-1",
                    external_codeHostUrl: "https://github.com",
                    orgId: 7,
                },
            },
            update: {
                ...existingRepo,
                connections: {
                    createMany: {
                        data: { connectionId: 42 },
                        skipDuplicates: true,
                    },
                },
            },
            create: existingRepo,
            select: {
                id: true,
                name: true,
                indexedAt: true,
            },
        });
        expect(mocks.repoToConnectionDeleteMany).toHaveBeenCalledWith({
            where: {
                connectionId: 42,
                repoId: {
                    in: [2, 3],
                },
            },
        });
        expect(result).toEqual({
            currentRepos: [
                {
                    id: 1,
                    name: "github.com/sourcebot/repo-1",
                    indexedAt,
                },
                {
                    id: 4,
                    name: "github.com/sourcebot/repo-4",
                    indexedAt: null,
                },
            ],
            unindexedRepos: [
                { id: 4, name: "github.com/sourcebot/repo-4" },
            ],
            orphanedRepos: [
                { id: 2, name: "github.com/sourcebot/repo-2" },
            ],
            affectedRepoIds: [1, 4, 2, 3],
        });
    });

    test("reconciles repo indexing schedules and immediate work", async () => {
        const trigger = vi.fn().mockResolvedValue("job");
        const indexedAt = new Date("2026-07-30T12:00:00.000Z");

        await reconcileRepoIndexWork({
            jobManager,
            trigger: trigger as ProcessContext<"connection-sync">["trigger"],
            currentRepos: [
                { id: 1, name: "repo-1", indexedAt },
                { id: 4, name: "repo-4", indexedAt: null },
            ],
            unindexedRepos: [{ id: 4, name: "repo-4" }],
            orphanedRepos: [{ id: 2, name: "repo-2" }],
            intervalMs: 3_600_000,
        });

        expect(mocks.upsertJobScheduler).toHaveBeenNthCalledWith(
            1,
            "repo-index",
            "repo-index-v1-1",
            3_600_000,
            { repoId: 1, type: "INDEX" },
            { priority: 10 },
        );
        expect(mocks.upsertJobScheduler).toHaveBeenNthCalledWith(
            2,
            "repo-index",
            "repo-index-v1-4",
            3_600_000,
            { repoId: 4, type: "INDEX" },
            { priority: 10 },
        );
        expect(mocks.removeJobScheduler).toHaveBeenCalledWith(
            "repo-index",
            "repo-index-v1-2",
        );
        expect(trigger).toHaveBeenNthCalledWith(
            1,
            "repo-index",
            {
                repoId: 2,
                type: "CLEANUP",
            },
            { priority: 10 },
        );
        expect(trigger).toHaveBeenNthCalledWith(
            2,
            "repo-index",
            {
                repoId: 4,
                type: "INDEX",
            },
            { priority: 5 },
        );
        expect(
            mocks.upsertJobScheduler.mock.invocationCallOrder[1],
        ).toBeLessThan(trigger.mock.invocationCallOrder[0]);
    });

    test("reconciles repo permission schedules and immediate work", async () => {
        const trigger = vi.fn().mockResolvedValue("job");
        const permissionSyncedAt = new Date("2026-07-30T12:00:00.000Z");
        mocks.repoFindMany.mockResolvedValue([
            { id: 1, permissionSyncedAt: null },
            { id: 4, permissionSyncedAt },
        ]);
        mocks.getJobSchedulerIds.mockResolvedValue([
            "repo-permission-sync-v1-1",
        ]);

        await reconcileRepoPermissionSyncWork({
            db,
            jobManager,
            trigger: trigger as ProcessContext<"connection-sync">["trigger"],
            enabled: true,
            affectedRepoIds: [1, 4, 2, 3],
            intervalMs: 21_600_000,
        });

        expect(mocks.repoFindMany).toHaveBeenCalledWith({
            where: {
                id: {
                    in: [1, 4, 2, 3],
                },
                ...REPO_PERMISSION_SYNC_WHERE,
            },
            select: {
                id: true,
                permissionSyncedAt: true,
            },
        });
        expect(mocks.upsertJobScheduler).toHaveBeenNthCalledWith(
            1,
            "repo-permission-sync",
            "repo-permission-sync-v1-1",
            21_600_000,
            { repoId: 1 },
            { priority: 10 },
        );
        expect(mocks.upsertJobScheduler).toHaveBeenNthCalledWith(
            2,
            "repo-permission-sync",
            "repo-permission-sync-v1-4",
            21_600_000,
            { repoId: 4 },
            { priority: 10 },
        );
        expect(mocks.removeJobScheduler).toHaveBeenNthCalledWith(
            1,
            "repo-permission-sync",
            "repo-permission-sync-v1-2",
        );
        expect(mocks.removeJobScheduler).toHaveBeenNthCalledWith(
            2,
            "repo-permission-sync",
            "repo-permission-sync-v1-3",
        );
        expect(trigger).toHaveBeenNthCalledWith(
            1,
            "repo-permission-sync",
            { repoId: 1 },
            { priority: 10 },
        );
        expect(trigger).toHaveBeenNthCalledWith(
            2,
            "repo-permission-sync",
            { repoId: 4 },
            { priority: 10 },
        );
    });

    test("removes permission schedules without querying eligibility when disabled", async () => {
        const trigger = vi.fn();

        await reconcileRepoPermissionSyncWork({
            db,
            jobManager,
            trigger: trigger as ProcessContext<"connection-sync">["trigger"],
            enabled: false,
            affectedRepoIds: [1, 2],
            intervalMs: 21_600_000,
        });

        expect(mocks.repoFindMany).not.toHaveBeenCalled();
        expect(mocks.getJobSchedulerIds).not.toHaveBeenCalled();
        expect(mocks.upsertJobScheduler).not.toHaveBeenCalled();
        expect(mocks.removeJobScheduler).toHaveBeenCalledTimes(2);
        expect(trigger).not.toHaveBeenCalled();
    });
});
