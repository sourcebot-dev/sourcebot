import type { PrismaClient } from "@sourcebot/db";
import { JOB_PRIORITIES } from "@sourcebot/shared";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createRepoCleanupWorkload, reindexReposWithMissingShards } from "./repoCleanupWorkload.js";
import type { JobManager } from "./types.js";

const fsMocks = vi.hoisted(() => ({
    existsSync: vi.fn(),
    readdir: vi.fn(),
    rm: vi.fn(),
}));

const lifecycleLogger = vi.hoisted(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
}));

vi.mock("@sourcebot/shared", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@sourcebot/shared")>()),
    createLogger: vi.fn(() => lifecycleLogger),
}));

vi.mock("fs", () => ({
    existsSync: fsMocks.existsSync,
}));

vi.mock("fs/promises", () => ({
    readdir: fsMocks.readdir,
    rm: fsMocks.rm,
}));

const repoFindUnique = vi.fn();
const repoFindMany = vi.fn();
const repoDeleteMany = vi.fn();
const repoUpdate = vi.fn();

const db = {
    repo: {
        findUnique: repoFindUnique,
        findMany: repoFindMany,
        deleteMany: repoDeleteMany,
        update: repoUpdate,
    },
} as unknown as PrismaClient;

const workload = createRepoCleanupWorkload({
    db,
    settings: {
        maxRepoIndexingJobConcurrency: 2,
    } as never,
});

const processContext = {
    data: { repoId: 42 },
    jobId: "job-1",
    attemptsMade: 0,
    maxAttempts: 2,
    prisma: db,
    signal: new AbortController().signal,
    updateProgress: vi.fn(),
    trigger: vi.fn(),
};

const eligibleRepo = {
    id: 42,
    name: "github.com/acme/repo",
    cloneUrl: "https://github.com/acme/repo.git",
    external_codeHostType: "github",
    orgId: 1,
    indexedAt: null,
    isAutoCleanupDisabled: false,
    connections: [],
};

describe("repoCleanupWorkload", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fsMocks.existsSync.mockReturnValue(false);
        fsMocks.readdir.mockResolvedValue([]);
        fsMocks.rm.mockResolvedValue(undefined);
        repoFindUnique.mockResolvedValue(eligibleRepo);
        repoFindMany.mockResolvedValue([]);
        repoDeleteMany.mockResolvedValue({ count: 1 });
        repoUpdate.mockResolvedValue(undefined);
    });

    test("validates eligibility without updating indexing job state", async () => {
        await workload.process(processContext);

        expect(repoFindUnique).toHaveBeenCalledWith({
            where: { id: 42 },
            include: {
                connections: true,
            },
        });
        expect(repoDeleteMany).toHaveBeenCalledWith({
            where: {
                id: 42,
                isAutoCleanupDisabled: false,
                connections: {
                    none: {},
                },
            },
        });
        expect(repoUpdate).not.toHaveBeenCalled();
        expect(workload.onStarted).toBeUndefined();
        expect(workload.onCompleted).toBeUndefined();
        expect(workload.onTerminalFailure).toBeUndefined();
    });

    test("removes only shards belonging to the exact repository id", async () => {
        fsMocks.readdir.mockResolvedValue([
            "1_42_v16.00000.zoekt",
            "1_420_v16.00000.zoekt",
        ]);

        await workload.process(processContext);

        expect(fsMocks.rm).toHaveBeenCalledWith(
            expect.stringContaining("1_42_v16.00000.zoekt"),
            { force: true },
        );
        expect(fsMocks.rm).not.toHaveBeenCalledWith(
            expect.stringContaining("1_420_v16.00000.zoekt"),
            expect.anything(),
        );
    });

    test("finishes orphaned filesystem cleanup when a retry finds no repo", async () => {
        repoFindUnique.mockResolvedValue(null);
        fsMocks.existsSync.mockReturnValue(true);
        fsMocks.readdir.mockResolvedValue([
            "1_42_v16.00000.zoekt",
            "1_99_v16.00000.zoekt",
        ]);

        await workload.process(processContext);

        expect(repoDeleteMany).not.toHaveBeenCalled();
        expect(fsMocks.rm).toHaveBeenCalledWith(
            expect.stringMatching(/repos\/42$/),
            { recursive: true, force: true },
        );
        expect(fsMocks.rm).toHaveBeenCalledWith(
            expect.stringContaining("1_42_v16.00000.zoekt"),
            { force: true },
        );
        expect(fsMocks.rm).not.toHaveBeenCalledWith(
            expect.stringContaining("1_99_v16.00000.zoekt"),
            expect.anything(),
        );
    });

    test.each([
        {
            name: "automatic cleanup is disabled",
            repo: { ...eligibleRepo, isAutoCleanupDisabled: true },
            reason: "automatic cleanup is disabled",
        },
        {
            name: "the repository was reattached",
            repo: { ...eligibleRepo, connections: [{}] },
            reason: "repository has been reattached to a connection",
        },
    ])("skips CLEANUP when $name", async ({ repo, reason }) => {
        repoFindUnique.mockResolvedValue(repo);

        await workload.process(processContext);

        expect(repoDeleteMany).not.toHaveBeenCalled();
        expect(fsMocks.readdir).not.toHaveBeenCalled();
        expect(lifecycleLogger.debug).toHaveBeenCalledWith(
            `Skipping CLEANUP job for repo 42: ${reason}`,
        );
    });

    test("revalidates cleanup eligibility when atomically deleting the repo", async () => {
        repoDeleteMany.mockResolvedValue({ count: 0 });

        await workload.process(processContext);

        expect(repoDeleteMany).toHaveBeenCalled();
        expect(fsMocks.readdir).not.toHaveBeenCalled();
        expect(lifecycleLogger.debug).toHaveBeenCalledWith(
            "Skipping CLEANUP job for repo 42: repository is no longer eligible for cleanup",
        );
    });
});

describe("reindexReposWithMissingShards", () => {
    const trigger = vi.fn();
    const jobManager = { trigger } as unknown as JobManager;

    beforeEach(() => {
        vi.clearAllMocks();
        fsMocks.existsSync.mockReturnValue(true);
        fsMocks.readdir.mockResolvedValue([]);
        repoFindMany.mockResolvedValue([]);
        trigger.mockResolvedValue("job-id");
    });

    test("still recovers eligible repos when the index directory doesn't exist", async () => {
        fsMocks.existsSync.mockReturnValue(false);
        repoFindMany.mockResolvedValue([
            { id: 42, name: "github.com/acme/repo" },
        ]);

        await reindexReposWithMissingShards(db, jobManager);

        expect(fsMocks.readdir).not.toHaveBeenCalled();
        expect(repoFindMany).toHaveBeenCalled();
        expect(trigger).toHaveBeenCalledWith(
            "repo-index",
            { repoId: 42 },
            { priority: JOB_PRIORITIES.SCHEDULED },
        );
    });

    test("re-queues an indexed repo with no shard on disk", async () => {
        fsMocks.readdir.mockResolvedValue([]);
        repoFindMany.mockResolvedValue([
            { id: 42, name: "github.com/acme/repo" },
        ]);

        await reindexReposWithMissingShards(db, jobManager);

        // Pins down the exact where-clause: repos still eligible for reindex
        // scheduling (has a connection, or explicitly pinned via
        // isAutoCleanupDisabled) that the DB believes are indexed. This mirrors
        // the set reconcileJobSchedulers.ts keeps on a recurring reindex
        // schedule, since orphaned repos with no such pin are the cleanup
        // workload's responsibility, not this one's.
        expect(repoFindMany).toHaveBeenCalledWith({
            where: {
                indexedAt: { not: null },
                OR: [
                    { connections: { some: {} } },
                    { isAutoCleanupDisabled: true },
                ],
            },
            select: { id: true, name: true },
        });
        expect(trigger).toHaveBeenCalledWith(
            "repo-index",
            { repoId: 42 },
            { priority: JOB_PRIORITIES.SCHEDULED },
        );
    });

    test("does not re-queue a repo that already has a shard on disk", async () => {
        fsMocks.readdir.mockResolvedValue(["1_42_v16.00000.zoekt"]);
        repoFindMany.mockResolvedValue([
            { id: 42, name: "github.com/acme/repo" },
        ]);

        await reindexReposWithMissingShards(db, jobManager);

        expect(trigger).not.toHaveBeenCalled();
    });

    test("does not re-queue a repo whose shard and .meta sidecar are both present", async () => {
        // The normal healthy state: zoekt always writes the .meta sidecar
        // alongside the real shard, so both show up in the same readdir().
        fsMocks.readdir.mockResolvedValue([
            "1_42_v16.00000.zoekt",
            "1_42_v16.00000.zoekt.meta",
        ]);
        repoFindMany.mockResolvedValue([
            { id: 42, name: "github.com/acme/repo" },
        ]);

        await reindexReposWithMissingShards(db, jobManager);

        expect(trigger).not.toHaveBeenCalled();
    });

    test("treats a lingering .tmp shard as missing", async () => {
        fsMocks.readdir.mockResolvedValue(["1_42_v16.00000.zoekt.tmp"]);
        repoFindMany.mockResolvedValue([
            { id: 42, name: "github.com/acme/repo" },
        ]);

        await reindexReposWithMissingShards(db, jobManager);

        expect(trigger).toHaveBeenCalledWith(
            "repo-index",
            { repoId: 42 },
            { priority: JOB_PRIORITIES.SCHEDULED },
        );
    });

    test("treats the .meta sidecar file alone as missing", async () => {
        // zoekt writes a `<shard>.meta` file alongside every real shard. If
        // only the sidecar survives a partial wipe, the repo has no searchable
        // index and must still be re-queued.
        fsMocks.readdir.mockResolvedValue(["1_42_v16.00000.zoekt.meta"]);
        repoFindMany.mockResolvedValue([
            { id: 42, name: "github.com/acme/repo" },
        ]);

        await reindexReposWithMissingShards(db, jobManager);

        expect(trigger).toHaveBeenCalledWith(
            "repo-index",
            { repoId: 42 },
            { priority: JOB_PRIORITIES.SCHEDULED },
        );
    });

    test("does not treat a numeric-prefixed non-shard file as a valid shard", async () => {
        fsMocks.readdir.mockResolvedValue(["1_42_backup"]);
        repoFindMany.mockResolvedValue([
            { id: 42, name: "github.com/acme/repo" },
        ]);

        await reindexReposWithMissingShards(db, jobManager);

        expect(trigger).toHaveBeenCalledWith(
            "repo-index",
            { repoId: 42 },
            { priority: JOB_PRIORITIES.SCHEDULED },
        );
    });

    test("ignores unrelated files in the index directory", async () => {
        fsMocks.readdir.mockResolvedValue([".DS_Store", "README.md"]);
        repoFindMany.mockResolvedValue([
            { id: 42, name: "github.com/acme/repo" },
        ]);

        await reindexReposWithMissingShards(db, jobManager);

        expect(trigger).toHaveBeenCalledWith(
            "repo-index",
            { repoId: 42 },
            { priority: JOB_PRIORITIES.SCHEDULED },
        );
    });

    test("recognizes a repo whose content is split across multiple shard files", async () => {
        fsMocks.readdir.mockResolvedValue([
            "1_42_v16.00000.zoekt",
            "1_42_v16.00001.zoekt",
        ]);
        repoFindMany.mockResolvedValue([
            { id: 42, name: "github.com/acme/repo" },
        ]);

        await reindexReposWithMissingShards(db, jobManager);

        expect(trigger).not.toHaveBeenCalled();
    });

    test("only re-queues the repo actually missing a shard among many", async () => {
        fsMocks.readdir.mockResolvedValue(["1_42_v16.00000.zoekt"]);
        repoFindMany.mockResolvedValue([
            { id: 42, name: "github.com/acme/healthy-repo" },
            { id: 43, name: "github.com/acme/broken-repo" },
        ]);

        await reindexReposWithMissingShards(db, jobManager);

        expect(trigger).toHaveBeenCalledTimes(1);
        expect(trigger).toHaveBeenCalledWith(
            "repo-index",
            { repoId: 43 },
            { priority: JOB_PRIORITIES.SCHEDULED },
        );
    });

    test("re-queues remaining repos even if one fails to enqueue", async () => {
        fsMocks.readdir.mockResolvedValue([]);
        repoFindMany.mockResolvedValue([
            { id: 42, name: "github.com/acme/flaky-repo" },
            { id: 43, name: "github.com/acme/broken-repo" },
        ]);
        trigger.mockImplementation(async (_name, data: { repoId: number }) => {
            if (data.repoId === 42) {
                throw new Error("redis connection reset");
            }
            return "job-id";
        });

        await expect(
            reindexReposWithMissingShards(db, jobManager),
        ).resolves.not.toThrow();

        expect(trigger).toHaveBeenCalledTimes(2);
        expect(trigger).toHaveBeenCalledWith(
            "repo-index",
            { repoId: 43 },
            { priority: JOB_PRIORITIES.SCHEDULED },
        );
        expect(lifecycleLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(
                "Failed to re-queue repo github.com/acme/flaky-repo (id: 42)",
            ),
            expect.any(Error),
        );
    });
});
