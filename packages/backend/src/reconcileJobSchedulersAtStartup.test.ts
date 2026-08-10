import type { PrismaClient } from "@sourcebot/db";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { reconcileJobSchedulersAtStartup } from "./reconcileJobSchedulersAtStartup.js";
import type { JobManager } from "./types.js";

const mocks = {
    accountFindMany: vi.fn(),
    connectionFindMany: vi.fn(),
    repoFindMany: vi.fn(),
    getJobSchedulerIds: vi.fn(),
    upsertJobScheduler: vi.fn(),
    removeJobScheduler: vi.fn(),
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

describe("reconcileJobSchedulersAtStartup", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.accountFindMany.mockResolvedValue([
            { id: "account-1" },
            { id: "account-2" },
        ]);
        mocks.connectionFindMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
        mocks.repoFindMany.mockResolvedValue([{ id: 42 }, { id: 84 }]);
        mocks.getJobSchedulerIds.mockResolvedValue([]);
        mocks.upsertJobScheduler.mockResolvedValue("scheduled-job");
        mocks.removeJobScheduler.mockResolvedValue(true);
    });

    test("reconciles connection, repository, and permission schedulers", async () => {
        await reconcileJobSchedulersAtStartup({
            db,
            jobManager,
            permissionSyncEnabled: true,
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

    test("removes permission schedulers when permission syncing is disabled", async () => {
        mocks.getJobSchedulerIds.mockImplementation(async (workloadName) => {
            if (workloadName === "account-permission-sync") {
                return ["account-permission-sync-v1-account-1"];
            }
            if (workloadName === "repo-permission-sync") {
                return ["repo-permission-sync-v1-42"];
            }
            return [];
        });

        await reconcileJobSchedulersAtStartup({
            db,
            jobManager,
            permissionSyncEnabled: false,
            settings: {
                resyncConnectionIntervalMs: 86_400_000,
                reindexIntervalMs: 3_600_000,
                userDrivenPermissionSyncIntervalMs: 43_200_000,
                repoDrivenPermissionSyncIntervalMs: 21_600_000,
            },
        });

        expect(mocks.accountFindMany).not.toHaveBeenCalled();
        expect(mocks.repoFindMany).toHaveBeenCalledOnce();
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
