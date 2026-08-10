import { Redis } from "ioredis";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ProcessContext, Workload } from "./types.js";

const mocks = vi.hoisted(() => {
    const jobLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        flush: vi.fn(),
    };
    return {
        enqueue: vi.fn(),
        upsertJobScheduler: vi.fn(),
        getJobSchedulerIds: vi.fn(),
        removeJobScheduler: vi.fn(),
        producerClose: vi.fn(),
        workerClose: vi.fn(),
        jobLogger,
        createBullMQJobLogger: vi.fn(() => jobLogger),
        workers: [] as Array<{
            processor: (job: unknown) => Promise<unknown>;
            handlers: Map<string, (...args: unknown[]) => void>;
        }>,
    };
});

// The module under test creates a logger at import time; stub it so importing pure helpers
// has no side effects (mirrors repoIndexManager.test.ts).
vi.mock("@sourcebot/shared", () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    })),
    createBullMQJobLogger: mocks.createBullMQJobLogger,
    scheduleToMs: vi.fn((schedule: string | number) =>
        typeof schedule === "number" ? schedule : 300_000,
    ),
    BullMQClient: class {
        enqueue = mocks.enqueue;
        upsertJobScheduler = mocks.upsertJobScheduler;
        getJobSchedulerIds = mocks.getJobSchedulerIds;
        removeJobScheduler = mocks.removeJobScheduler;
        close = mocks.producerClose;
        getQueue = vi.fn(() => ({
            getJobCounts: vi.fn(),
            upsertJobScheduler: vi.fn(),
        }));
    },
}));

// Mock the constants module directly so its env-derived cache-dir paths don't load.
vi.mock("./constants.js", () => ({
    WORKER_STOP_GRACEFUL_TIMEOUT_MS: 5000,
}));

vi.mock("@sentry/node", () => ({
    captureException: vi.fn(),
}));

vi.mock("bullmq", () => ({
    Worker: class {
        private readonly record: (typeof mocks.workers)[number];

        constructor(
            _name: string,
            processor: (job: unknown) => Promise<unknown>,
        ) {
            this.record = { processor, handlers: new Map() };
            mocks.workers.push(this.record);
        }

        on(event: string, handler: (...args: unknown[]) => void) {
            this.record.handlers.set(event, handler);
        }

        close = mocks.workerClose;
    },
}));

import { BullMQJobManager } from "./jobManager.js";

const createWorkload = (
    overrides: Partial<Workload<"connection-sync", { repoCount: number }>> = {},
): Workload<"connection-sync", { repoCount: number }> => ({
    queueSpec: {
        name: "connection-sync",
        dedupKey: ({ connectionId }) => `connection:${connectionId}`,
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
    concurrency: 2,
    process: vi.fn(async () => ({ repoCount: 3 })),
    ...overrides,
});

const data = { connectionId: 42 };
const job = {
    id: "job-1",
    queueName: "connection-sync",
    data,
    attemptsMade: 2,
    opts: { attempts: 2 },
    log: vi.fn(),
    updateProgress: vi.fn(),
};

describe("BullMQJobManager lifecycle", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.workers.length = 0;
        mocks.enqueue.mockResolvedValue("job-1");
        mocks.upsertJobScheduler.mockResolvedValue("scheduled-job-1");
        mocks.getJobSchedulerIds.mockResolvedValue([]);
        mocks.removeJobScheduler.mockResolvedValue(true);
        mocks.workerClose.mockResolvedValue(undefined);
        mocks.producerClose.mockResolvedValue(undefined);
    });

    test("delegates enqueueing to BullMQClient and returns its job id", async () => {
        const manager = new BullMQJobManager({} as Redis);
        const workload = createWorkload();
        manager.register(workload);

        const result = await manager.trigger(
            "connection-sync",
            data,
            { priority: 1 },
        );

        expect(result).toBe("job-1");
        expect(mocks.enqueue).toHaveBeenCalledWith(
            workload.queueSpec,
            data,
            { priority: 1 },
        );
    });

    test("manages schedulers through the registered workload", async () => {
        const manager = new BullMQJobManager({} as Redis);
        const workload = createWorkload();
        manager.register(workload);

        await expect(
            manager.upsertJobScheduler(
                "connection-sync",
                "connection-sync-v1-42",
                60_000,
                data,
                { priority: 10 },
            ),
        ).resolves.toBe("scheduled-job-1");
        expect(mocks.upsertJobScheduler).toHaveBeenCalledWith(
            workload.queueSpec,
            "connection-sync-v1-42",
            60_000,
            data,
            { priority: 10 },
        );

        mocks.getJobSchedulerIds.mockResolvedValue(["connection-sync-v1-42"]);
        await expect(
            manager.getJobSchedulerIds("connection-sync"),
        ).resolves.toEqual(["connection-sync-v1-42"]);
        expect(mocks.getJobSchedulerIds).toHaveBeenCalledWith(
            workload.queueSpec,
        );

        await expect(
            manager.removeJobScheduler(
                "connection-sync",
                "connection-sync-v1-42",
            ),
        ).resolves.toBe(true);
        expect(mocks.removeJobScheduler).toHaveBeenCalledWith(
            workload.queueSpec,
            "connection-sync-v1-42",
        );
    });

    test("upserts a declared workload schedule when starting", async () => {
        const manager = new BullMQJobManager({} as Redis);
        const workload = createWorkload({
            schedule: {
                interval: "5m",
                data,
                options: { priority: 10 },
            },
        });
        manager.register(workload);

        await manager.start();

        expect(mocks.upsertJobScheduler).toHaveBeenCalledWith(
            workload.queueSpec,
            "schedule:connection-sync",
            "5m",
            data,
            { priority: 10 },
        );
    });

    test("closes workers and producer queues when stopping", async () => {
        const manager = new BullMQJobManager({} as Redis);
        manager.register(createWorkload());
        await manager.start();

        await manager.stop();

        expect(mocks.workerClose).toHaveBeenCalledOnce();
        expect(mocks.producerClose).toHaveBeenCalledOnce();
    });

    test("calls onStarted before processing and onCompleted after completion", async () => {
        const calls: string[] = [];
        const workload = createWorkload({
            onStarted: vi.fn(async ({ logger }) => {
                logger.info("Lifecycle started");
                calls.push("started");
            }),
            process: vi.fn(async () => {
                calls.push("processed");
                return { repoCount: 3 };
            }),
            onCompleted: vi.fn(async ({ logger }) => {
                logger.info("Lifecycle completed");
                calls.push("completed");
            }),
        });
        const manager = new BullMQJobManager({} as Redis);
        manager.register(workload);
        await manager.start();

        const result = await mocks.workers[0].processor({
            ...job,
            attemptsMade: 0,
        });
        expect(calls).toEqual(["started", "processed"]);

        mocks.workers[0].handlers.get("completed")?.(job, result);
        await vi.waitFor(() =>
            expect(calls).toEqual(["started", "processed", "completed"]),
        );
        expect(workload.onCompleted).toHaveBeenCalledWith(
            expect.objectContaining({
                data,
                jobId: "job-1",
                maxAttempts: 2,
                logger: mocks.jobLogger,
            }),
            { repoCount: 3 },
        );
        expect(mocks.jobLogger.info).toHaveBeenCalledWith("Lifecycle started");
        expect(mocks.jobLogger.info).toHaveBeenCalledWith(
            "Lifecycle completed",
        );
        await vi.waitFor(() => {
            expect(mocks.jobLogger.flush).toHaveBeenCalledTimes(2);
        });
    });

    test("provides the structured job logger to the workload processor", async () => {
        const process = vi.fn(
            async (context: ProcessContext<"connection-sync">) => {
                context.logger.info("Processing connection");
                return { repoCount: 3 };
            },
        );
        const manager = new BullMQJobManager({} as Redis);
        manager.register(createWorkload({ process }));
        await manager.start();

        await mocks.workers[0].processor({ ...job, attemptsMade: 0 });

        expect(process).toHaveBeenCalledWith(
            expect.objectContaining({
                logger: mocks.jobLogger,
            }),
        );
        expect(mocks.jobLogger.info).toHaveBeenCalledWith(
            "Processing connection",
        );
        expect(mocks.jobLogger.flush).toHaveBeenCalled();
    });

    test("reports lifecycle metadata after terminal failure", async () => {
        const onTerminalFailure = vi.fn(async ({ logger }) => {
            logger.error("Lifecycle failed");
        });
        const workload = createWorkload({ onTerminalFailure });
        const manager = new BullMQJobManager({} as Redis);
        manager.register(workload);
        await manager.start();

        const error = new Error("failed");
        mocks.workers[0].handlers.get("failed")?.(job, error);

        await vi.waitFor(() => {
            expect(onTerminalFailure).toHaveBeenCalledWith(
                expect.objectContaining({
                    data,
                    jobId: "job-1",
                    attemptsMade: 2,
                    maxAttempts: 2,
                    logger: mocks.jobLogger,
                }),
                error,
            );
        });
        expect(mocks.jobLogger.error).toHaveBeenCalledWith("Lifecycle failed");
        await vi.waitFor(() => {
            expect(mocks.jobLogger.flush).toHaveBeenCalledOnce();
        });
        expect(mocks.createBullMQJobLogger).toHaveBeenCalledWith(
            expect.objectContaining({ id: "job-1", attemptsMade: 2 }),
            expect.objectContaining({ attempt: 2 }),
        );
    });
});
