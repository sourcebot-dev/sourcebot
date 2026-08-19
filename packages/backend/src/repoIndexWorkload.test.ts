import type { PrismaClient } from "@sourcebot/db";
import { beforeEach, describe, expect, test, vi } from "vitest";

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

import { createRepoIndexWorkload } from "./repoIndexWorkload.js";

const repoFindUnique = vi.fn();
const repoDeleteMany = vi.fn();
const repoUpdate = vi.fn();
const repoUpdateMany = vi.fn();

const transaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
        repo: {
            findUnique: repoFindUnique,
            update: repoUpdate,
        },
    }),
);

const db = {
    $transaction: transaction,
    repo: {
        deleteMany: repoDeleteMany,
        updateMany: repoUpdateMany,
    },
} as unknown as PrismaClient;

const workload = createRepoIndexWorkload({
    db,
    settings: {
        maxRepoIndexingJobConcurrency: 2,
    } as never,
});

const lifecycleContext = {
    data: {
        repoId: 42,
        type: "INDEX" as const,
    },
    jobId: "job-1",
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

describe("repoIndexWorkload", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fsMocks.existsSync.mockReturnValue(false);
        fsMocks.readdir.mockResolvedValue([]);
        fsMocks.rm.mockResolvedValue(undefined);
        repoFindUnique.mockResolvedValue(eligibleRepo);
        repoDeleteMany.mockResolvedValue({ count: 1 });
        repoUpdate.mockResolvedValue(undefined);
        repoUpdateMany.mockResolvedValue({ count: 1 });
    });

    test("uses the same repository execution lock for INDEX and CLEANUP", () => {
        expect(workload.executionLock).toBeDefined();
        expect(
            workload.executionLock?.resource({ repoId: 42, type: "INDEX" }),
        ).toBe("sourcebot:lock:repo:42");
        expect(
            workload.executionLock?.resource({ repoId: 42, type: "CLEANUP" }),
        ).toBe("sourcebot:lock:repo:42");
        expect(workload.executionLock?.durationMs).toBe(60_000);
        expect(workload.queueSpec.dedupKey).toBeUndefined();
        expect(workload.onStarted).toBeUndefined();
        expect(workload.onCompleted).toBeTypeOf("function");
        expect(workload.onTerminalFailure).toBeTypeOf("function");
    });

    test("records the first successful indexing job terminal state", async () => {
        await workload.onCompleted?.(lifecycleContext, undefined);

        expect(repoUpdateMany).toHaveBeenCalledWith({
            where: {
                id: 42,
                firstIndexingJobFinishedAt: null,
            },
            data: {
                firstIndexingJobFinishedAt: expect.any(Date),
            },
        });
    });

    test("records the first failed indexing job terminal state", async () => {
        await workload.onTerminalFailure?.(
            lifecycleContext,
            new Error("indexing failed"),
        );

        expect(repoUpdateMany).toHaveBeenCalledWith({
            where: {
                id: 42,
                firstIndexingJobFinishedAt: null,
            },
            data: {
                firstIndexingJobFinishedAt: expect.any(Date),
            },
        });
    });

    test("does not mark cleanup jobs as an initial indexing attempt", async () => {
        await workload.onCompleted?.({
            ...lifecycleContext,
            data: { repoId: 42, type: "CLEANUP" },
        }, undefined);

        expect(repoUpdateMany).not.toHaveBeenCalled();
    });

    test("validates state and records the latest job inside process", async () => {
        await workload.process({
            ...processContext,
            data: { repoId: 42, type: "CLEANUP" },
        });

        expect(repoFindUnique).toHaveBeenCalledWith({
            where: { id: 42 },
            include: {
                connections: {
                    include: {
                        connection: true,
                    },
                },
            },
        });
        expect(repoUpdate).toHaveBeenCalledWith({
            where: {
                id: 42,
            },
            data: {
                latestIndexingJobId: "job-1",
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
    });

    test("cleanup removes only shards belonging to the exact repository id", async () => {
        fsMocks.readdir.mockResolvedValue([
            "1_42_v16.00000.zoekt",
            "1_420_v16.00000.zoekt",
        ]);

        await workload.process({
            ...processContext,
            data: { repoId: 42, type: "CLEANUP" },
        });

        expect(fsMocks.rm).toHaveBeenCalledWith(
            expect.stringContaining("1_42_v16.00000.zoekt"),
            { force: true },
        );
        expect(fsMocks.rm).not.toHaveBeenCalledWith(
            expect.stringContaining("1_420_v16.00000.zoekt"),
            expect.anything(),
        );
    });

    test("skips an INDEX job when the repository no longer exists", async () => {
        repoFindUnique.mockResolvedValue(null);

        await workload.process(processContext);

        expect(repoUpdate).not.toHaveBeenCalled();
        expect(repoDeleteMany).not.toHaveBeenCalled();
        expect(fsMocks.readdir).not.toHaveBeenCalled();
        expect(lifecycleLogger.debug).toHaveBeenCalledWith(
            "Skipping INDEX job for repo 42: repository no longer exists",
        );
    });

    test("finishes orphaned filesystem cleanup when a CLEANUP retry finds no repo", async () => {
        repoFindUnique.mockResolvedValue(null);
        fsMocks.existsSync.mockReturnValue(true);
        fsMocks.readdir.mockResolvedValue([
            "1_42_v16.00000.zoekt",
            "1_99_v16.00000.zoekt",
        ]);

        await workload.process({
            ...processContext,
            data: { repoId: 42, type: "CLEANUP" },
        });

        expect(repoUpdate).not.toHaveBeenCalled();
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

        await workload.process({
            ...processContext,
            data: { repoId: 42, type: "CLEANUP" },
        });

        expect(repoUpdate).not.toHaveBeenCalled();
        expect(repoDeleteMany).not.toHaveBeenCalled();
        expect(fsMocks.readdir).not.toHaveBeenCalled();
        expect(lifecycleLogger.debug).toHaveBeenCalledWith(
            `Skipping CLEANUP job for repo 42: ${reason}`,
        );
    });

    test("revalidates cleanup eligibility when atomically deleting the repo", async () => {
        repoDeleteMany.mockResolvedValue({ count: 0 });

        await workload.process({
            ...processContext,
            data: { repoId: 42, type: "CLEANUP" },
        });

        expect(repoUpdate).toHaveBeenCalled();
        expect(repoDeleteMany).toHaveBeenCalled();
        expect(fsMocks.readdir).not.toHaveBeenCalled();
        expect(lifecycleLogger.debug).toHaveBeenCalledWith(
            "Skipping CLEANUP job for repo 42: repository is no longer eligible for cleanup",
        );
    });

});
