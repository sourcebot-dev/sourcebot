import type { PrismaClient } from "@sourcebot/db";
import { beforeEach, describe, expect, test, vi } from "vitest";

const isPermissionSyncEnabled = vi.hoisted(() => vi.fn());

vi.mock("./entitlements.js", () => ({
    isPermissionSyncEnabled,
}));

import { reconcileJobSchedulers } from "./reconcileJobSchedulers.js";
import type { JobManager } from "./types.js";

const mocks = {
    accountFindMany: vi.fn(),
    connectionFindMany: vi.fn(),
    repoFindMany: vi.fn(),
    getJobSchedulerIds: vi.fn(),
    upsertJobScheduler: vi.fn(),
    removeJobScheduler: vi.fn(),
    trigger: vi.fn(),
};

const db = {
    account: {
        findMany: mocks.accountFindMany,
    },
    connection: {
        findMany: mocks.connectionFindMany,
    },
    repo: {
        findMany: mocks.repoFindMany,
    },
} as unknown as PrismaClient;

const jobManager = mocks as unknown as JobManager;

describe("reconcileJobSchedulers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.accountFindMany.mockResolvedValue([
            { id: "account-1" },
            { id: "account-2" },
        ]);
        mocks.connectionFindMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
        mocks.repoFindMany.mockImplementation(async ({ where }) =>
            where?.isAutoCleanupDisabled === false
                ? []
                : [{ id: 42 }, { id: 84 }],
        );
        mocks.getJobSchedulerIds.mockResolvedValue([]);
        mocks.upsertJobScheduler.mockResolvedValue("scheduled-job");
        mocks.removeJobScheduler.mockResolvedValue(true);
        mocks.trigger.mockResolvedValue("triggered-job");
        isPermissionSyncEnabled.mockResolvedValue(true);
    });

    test("reconciles connection, repository, and permission schedulers", async () => {
        await reconcileJobSchedulers({
            db,
            jobManager,
            settings: {
                resyncConnectionIntervalMs: 86_400_000,
                reindexIntervalMs: 3_600_000,
                userDrivenPermissionSyncIntervalMs: 43_200_000,
                repoDrivenPermissionSyncIntervalMs: 21_600_000,
            },
        });

        expect(mocks.connectionFindMany).toHaveBeenCalledWith({
            select: { id: true },
        });
        expect(mocks.repoFindMany).toHaveBeenCalledWith({
            where: {
                OR: [
                    {
                        connections: {
                            some: {},
                        },
                    },
                    {
                        isAutoCleanupDisabled: true,
                    },
                ],
            },
            select: { id: true },
        });
        expect(mocks.repoFindMany).toHaveBeenCalledWith({
            where: {
                connections: {
                    none: {},
                },
                isAutoCleanupDisabled: false,
            },
            select: { id: true },
        });
        expect(mocks.accountFindMany).toHaveBeenCalledWith({
            where: {
                providerType: {
                    in: [
                        "github",
                        "gitlab",
                        "bitbucket-cloud",
                        "bitbucket-server",
                    ],
                },
            },
            select: { id: true },
        });
        expect(mocks.repoFindMany).toHaveBeenCalledWith({
            where: {
                isPublic: false,
                external_codeHostType: {
                    in: [
                        "github",
                        "gitlab",
                        "bitbucketCloud",
                        "bitbucketServer",
                    ],
                },
                connections: {
                    some: {
                        connection: {
                            enforcePermissions: true,
                        },
                    },
                },
            },
            select: { id: true },
        });
        expect(mocks.upsertJobScheduler).toHaveBeenCalledWith(
            "connection-sync",
            "connection-sync-v1-1",
            86_400_000,
            { connectionId: 1 },
            { priority: 10 },
        );
        expect(mocks.upsertJobScheduler).toHaveBeenCalledWith(
            "repo-index",
            "repo-index-v1-42",
            3_600_000,
            { repoId: 42, type: "INDEX" },
            { priority: 10 },
        );
        expect(mocks.upsertJobScheduler).toHaveBeenCalledWith(
            "account-permission-sync",
            "account-permission-sync-v1-account-1",
            43_200_000,
            { accountId: "account-1" },
            { priority: 10 },
        );
        expect(mocks.upsertJobScheduler).toHaveBeenCalledWith(
            "repo-permission-sync",
            "repo-permission-sync-v1-42",
            21_600_000,
            { repoId: 42 },
            { priority: 10 },
        );
    });

    test("removes index schedulers and cleans up orphaned repos", async () => {
        mocks.repoFindMany.mockImplementation(async ({ where }) => {
            if (where?.isAutoCleanupDisabled === false) {
                return [{ id: 84 }];
            }
            if (where?.isPublic === false) {
                return [];
            }
            return [{ id: 42 }];
        });
        mocks.getJobSchedulerIds.mockImplementation(async (workloadName) =>
            workloadName === "repo-index"
                ? ["repo-index-v1-42", "repo-index-v1-84"]
                : [],
        );

        await reconcileJobSchedulers({
            db,
            jobManager,
            settings: {
                resyncConnectionIntervalMs: 86_400_000,
                reindexIntervalMs: 3_600_000,
                userDrivenPermissionSyncIntervalMs: 43_200_000,
                repoDrivenPermissionSyncIntervalMs: 21_600_000,
            },
        });

        expect(mocks.upsertJobScheduler).toHaveBeenCalledWith(
            "repo-index",
            "repo-index-v1-42",
            3_600_000,
            { repoId: 42, type: "INDEX" },
            { priority: 10 },
        );
        expect(mocks.upsertJobScheduler).not.toHaveBeenCalledWith(
            "repo-index",
            "repo-index-v1-84",
            expect.anything(),
            expect.anything(),
            expect.anything(),
        );
        expect(mocks.removeJobScheduler).toHaveBeenCalledWith(
            "repo-index",
            "repo-index-v1-84",
        );
        expect(mocks.trigger).toHaveBeenCalledWith(
            "repo-index",
            { repoId: 84, type: "CLEANUP" },
            { priority: 10 },
        );
        expect(
            mocks.removeJobScheduler.mock.invocationCallOrder[0],
        ).toBeLessThan(mocks.trigger.mock.invocationCallOrder[0]);
    });

    test("keeps index schedulers for repos with automatic cleanup disabled", async () => {
        mocks.repoFindMany.mockImplementation(async ({ where }) => {
            if (where?.isAutoCleanupDisabled === false) {
                return [];
            }
            if (where?.isPublic === false) {
                return [];
            }
            return [{ id: 42 }, { id: 84 }];
        });
        mocks.getJobSchedulerIds.mockImplementation(async (workloadName) =>
            workloadName === "repo-index" ? ["repo-index-v1-84"] : [],
        );

        await reconcileJobSchedulers({
            db,
            jobManager,
            settings: {
                resyncConnectionIntervalMs: 86_400_000,
                reindexIntervalMs: 3_600_000,
                userDrivenPermissionSyncIntervalMs: 43_200_000,
                repoDrivenPermissionSyncIntervalMs: 21_600_000,
            },
        });

        expect(mocks.upsertJobScheduler).toHaveBeenCalledWith(
            "repo-index",
            "repo-index-v1-84",
            3_600_000,
            { repoId: 84, type: "INDEX" },
            { priority: 10 },
        );
        expect(mocks.removeJobScheduler).not.toHaveBeenCalledWith(
            "repo-index",
            "repo-index-v1-84",
        );
    });

    test("removes permission schedulers when permission syncing is disabled", async () => {
        isPermissionSyncEnabled.mockResolvedValue(false);
        mocks.getJobSchedulerIds.mockImplementation(async (workloadName) => {
            if (workloadName === "account-permission-sync") {
                return ["account-permission-sync-v1-account-1"];
            }
            if (workloadName === "repo-permission-sync") {
                return ["repo-permission-sync-v1-42"];
            }
            return [];
        });

        await reconcileJobSchedulers({
            db,
            jobManager,
            settings: {
                resyncConnectionIntervalMs: 86_400_000,
                reindexIntervalMs: 3_600_000,
                userDrivenPermissionSyncIntervalMs: 43_200_000,
                repoDrivenPermissionSyncIntervalMs: 21_600_000,
            },
        });

        expect(mocks.accountFindMany).not.toHaveBeenCalled();
        expect(mocks.repoFindMany).toHaveBeenCalledTimes(2);
        expect(mocks.removeJobScheduler).toHaveBeenCalledWith(
            "account-permission-sync",
            "account-permission-sync-v1-account-1",
        );
        expect(mocks.removeJobScheduler).toHaveBeenCalledWith(
            "repo-permission-sync",
            "repo-permission-sync-v1-42",
        );
        expect(mocks.upsertJobScheduler).not.toHaveBeenCalledWith(
            expect.stringContaining("permission-sync"),
            expect.anything(),
            expect.anything(),
            expect.anything(),
        );
    });
});
