import type { PrismaClient } from "@sourcebot/db";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createRepoCleanupWorkload } from "./repoCleanupWorkload.js";
import { createRepoIndexWorkload } from "./repoIndexWorkload.js";

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

const repoFindUnique = vi.fn();
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
        updateMany: repoUpdateMany,
    },
} as unknown as PrismaClient;

const settings = {
    maxRepoIndexingJobConcurrency: 2,
} as never;

const workload = createRepoIndexWorkload({ db, settings });
const cleanupWorkload = createRepoCleanupWorkload({ db, settings });

const lifecycleContext = {
    data: {
        repoId: 42,
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

describe("repoIndexWorkload", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        repoFindUnique.mockResolvedValue(null);
        repoUpdate.mockResolvedValue(undefined);
        repoUpdateMany.mockResolvedValue({ count: 1 });
    });

    test("shares its repository execution lock with cleanup", () => {
        expect(workload.executionLock).toBe(cleanupWorkload.executionLock);
        expect(
            workload.executionLock?.resource({ repoId: 42 }),
        ).toBe("sourcebot:lock:repo:42");
        expect(cleanupWorkload.executionLock?.resource({ repoId: 42 })).toBe(
            "sourcebot:lock:repo:42",
        );
        expect(workload.executionLock?.durationMs).toBe(60_000);
        expect(workload.queueSpec.name).toBe("repo-index");
        expect(cleanupWorkload.queueSpec.name).toBe("repo-cleanup");
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

    test("skips an INDEX job when the repository no longer exists", async () => {
        await workload.process(processContext);

        expect(repoUpdate).not.toHaveBeenCalled();
        expect(lifecycleLogger.debug).toHaveBeenCalledWith(
            "Skipping INDEX job for repo 42: repository no longer exists",
        );
    });
});
