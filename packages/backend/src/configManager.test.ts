import type { JobManager } from "./types.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
    const watcher = {
        on: vi.fn(),
        close: vi.fn(),
    };
    watcher.on.mockReturnValue(watcher);

    return {
        watcher,
        loadConfig: vi.fn(),
        resolveConfigSettings: vi.fn(),
        syncSearchContexts: vi.fn(),
        trigger: vi.fn(),
        upsertJobScheduler: vi.fn(),
        getJobSchedulerIds: vi.fn(),
        removeJobScheduler: vi.fn(),
        connectionFindUnique: vi.fn(),
        connectionCreate: vi.fn(),
        connectionUpdate: vi.fn(),
        connectionFindMany: vi.fn(),
        connectionDelete: vi.fn(),
        repoFindMany: vi.fn(),
        repoToConnectionDeleteMany: vi.fn(),
        isPermissionSyncEnabled: vi.fn(),
    };
});

vi.mock("@sourcebot/shared", () => ({
    createLogger: vi.fn(() => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    })),
    env: {
        DATA_CACHE_DIR: "test-data",
        PERMISSION_SYNC_ENABLED: "false",
    },
    JOB_PRIORITIES: {
        INTERACTIVE: 1,
        SCHEDULED: 10,
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
    resolveConfigSettings: mocks.resolveConfigSettings,
}));

vi.mock("chokidar", () => ({
    default: {
        watch: vi.fn(() => mocks.watcher),
    },
}));

vi.mock("./ee/syncSearchContexts.js", () => ({
    syncSearchContexts: mocks.syncSearchContexts,
}));

vi.mock("./entitlements.js", () => ({
    isPermissionSyncEnabled: mocks.isPermissionSyncEnabled,
}));

vi.mock("./prisma.js", () => ({
    prisma: {
        connection: {
            findUnique: mocks.connectionFindUnique,
            create: mocks.connectionCreate,
            update: mocks.connectionUpdate,
            findMany: mocks.connectionFindMany,
            delete: mocks.connectionDelete,
        },
        repo: {
            findMany: mocks.repoFindMany,
        },
        repoToConnection: {
            deleteMany: mocks.repoToConnectionDeleteMany,
        },
    },
}));

import { ConfigManager } from "./configManager.js";

const jobManager = {
    trigger: mocks.trigger,
    upsertJobScheduler: mocks.upsertJobScheduler,
    getJobSchedulerIds: mocks.getJobSchedulerIds,
    removeJobScheduler: mocks.removeJobScheduler,
} as unknown as JobManager;

describe("ConfigManager", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        mocks.watcher.on.mockReturnValue(mocks.watcher);
        mocks.resolveConfigSettings.mockReturnValue({
            resyncConnectionIntervalMs: 86_400_000,
            reindexIntervalMs: 3_600_000,
            repoDrivenPermissionSyncIntervalMs: 86_400_000,
        });
        mocks.syncSearchContexts.mockResolvedValue(undefined);
        mocks.trigger.mockResolvedValue("triggered-job");
        mocks.upsertJobScheduler.mockResolvedValue("scheduled-job");
        mocks.removeJobScheduler.mockResolvedValue(true);
        mocks.connectionFindUnique.mockResolvedValue(null);
        mocks.connectionCreate.mockResolvedValue({ id: 42 });
        mocks.connectionUpdate.mockResolvedValue({ id: 42 });
        mocks.connectionFindMany.mockResolvedValue([]);
        mocks.connectionDelete.mockResolvedValue(undefined);
        mocks.repoFindMany.mockResolvedValue([]);
        mocks.repoToConnectionDeleteMany.mockResolvedValue({ count: 0 });
        mocks.getJobSchedulerIds.mockResolvedValue([]);
        mocks.isPermissionSyncEnabled.mockResolvedValue(false);
    });

    test("triggers a new connection during config sync", async () => {
        const connectionConfig = {
            type: "github",
            url: "https://github.com",
        };
        mocks.loadConfig.mockResolvedValue({
            connections: { sourcebot: connectionConfig },
            contexts: {},
        });
        const manager = new ConfigManager(jobManager, "/config.json");

        await manager.syncConfig();

        expect(mocks.trigger).toHaveBeenCalledWith(
            "connection-sync",
            { connectionId: 42 },
            { priority: 1 },
        );
        expect(mocks.upsertJobScheduler).toHaveBeenCalledWith(
            "connection-sync",
            "connection-sync-v1-42",
            86_400_000,
            { connectionId: 42 },
            { priority: 10 },
        );
        expect(mocks.connectionCreate.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.upsertJobScheduler.mock.invocationCallOrder[0],
        );
        expect(
            mocks.upsertJobScheduler.mock.invocationCallOrder[0],
        ).toBeLessThan(mocks.trigger.mock.invocationCallOrder[0]);
        expect(mocks.syncSearchContexts).toHaveBeenCalledWith({
            contexts: {},
            orgId: 1,
        });
    });

    test("deletes connections removed from the config", async () => {
        mocks.loadConfig.mockResolvedValue({});
        mocks.connectionFindMany.mockResolvedValue([
            { id: 42, name: "removed-connection" },
        ]);
        const manager = new ConfigManager(jobManager, "/config.json");

        await manager.syncConfig();

        expect(mocks.connectionDelete).toHaveBeenCalledWith({
            where: { id: 42 },
        });
        expect(mocks.removeJobScheduler).toHaveBeenCalledWith(
            "connection-sync",
            "connection-sync-v1-42",
        );
        expect(
            mocks.removeJobScheduler.mock.invocationCallOrder[0],
        ).toBeLessThan(mocks.connectionDelete.mock.invocationCallOrder[0]);
    });

    test("cleans up orphaned repos and reconciles shared repos before deleting a connection", async () => {
        mocks.loadConfig.mockResolvedValue({});
        mocks.connectionFindMany.mockResolvedValue([
            { id: 42, name: "removed-connection", orgId: 1 },
        ]);
        mocks.repoFindMany
            .mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
            .mockResolvedValueOnce([{ id: 1, name: "orphaned-repo" }])
            .mockResolvedValueOnce([
                { id: 2, permissionSyncedAt: new Date("2026-08-15") },
            ]);
        mocks.getJobSchedulerIds.mockResolvedValue([
            "repo-permission-sync-v1-2",
        ]);
        mocks.isPermissionSyncEnabled.mockResolvedValue(true);
        const manager = new ConfigManager(jobManager, "/config.json");

        await manager.syncConfig();

        expect(mocks.repoToConnectionDeleteMany).toHaveBeenCalledWith({
            where: {
                connectionId: 42,
                repoId: { in: [1, 2] },
            },
        });
        expect(mocks.removeJobScheduler).toHaveBeenCalledWith(
            "repo-index",
            "repo-index-v1-1",
        );
        expect(mocks.removeJobScheduler).not.toHaveBeenCalledWith(
            "repo-index",
            "repo-index-v1-2",
        );
        expect(mocks.trigger).toHaveBeenCalledWith(
            "repo-cleanup",
            { repoId: 1 },
            { priority: 10 },
        );
        expect(mocks.trigger).not.toHaveBeenCalledWith(
            "repo-cleanup",
            { repoId: 2 },
            expect.anything(),
        );
        expect(mocks.removeJobScheduler).toHaveBeenCalledWith(
            "repo-permission-sync",
            "repo-permission-sync-v1-1",
        );
        expect(mocks.removeJobScheduler).not.toHaveBeenCalledWith(
            "repo-permission-sync",
            "repo-permission-sync-v1-2",
        );
        expect(mocks.upsertJobScheduler).toHaveBeenCalledWith(
            "repo-permission-sync",
            "repo-permission-sync-v1-2",
            86_400_000,
            { repoId: 2 },
            { priority: 10 },
        );
        expect(mocks.connectionDelete).toHaveBeenCalledWith({
            where: { id: 42 },
        });
        expect(
            mocks.trigger.mock.invocationCallOrder[0],
        ).toBeLessThan(mocks.connectionDelete.mock.invocationCallOrder[0]);
    });

    test("does not trigger an unchanged connection", async () => {
        const connectionConfig = {
            type: "github",
            url: "https://github.com",
        };
        mocks.loadConfig.mockResolvedValue({
            connections: { sourcebot: connectionConfig },
        });
        mocks.connectionFindUnique.mockResolvedValue({
            id: 42,
            config: connectionConfig,
        });
        const manager = new ConfigManager(jobManager, "/config.json");

        await manager.syncConfig();

        expect(mocks.upsertJobScheduler).not.toHaveBeenCalled();
        expect(mocks.trigger).not.toHaveBeenCalled();
    });
});
