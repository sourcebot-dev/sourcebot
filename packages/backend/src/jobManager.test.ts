import { Redis } from "ioredis";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ProcessContext, Workload } from "./types.js";

const mocks = vi.hoisted(() => {
    const logger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    };
    const jobLogSink = {
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
        executionLockUsing: vi.fn(),
        logger,
        jobLogSink,
        createBullMQJobLogSink: vi.fn(() => jobLogSink),
        runWithJobLogContext: vi.fn(
            (_context: unknown, callback: () => unknown) => callback(),
        ),
        workers: [] as Array<{
            processor: (job: unknown) => Promise<unknown>;
            handlers: Map<string, (...args: unknown[]) => void>;
        }>,
    };
});

// The module under test creates a logger at import time; stub it so importing pure helpers
// has no side effects (mirrors repoIndexManager.test.ts).
vi.mock("@sourcebot/shared", () => ({
    createLogger: vi.fn(() => mocks.logger),
    createBullMQJobLogSink: mocks.createBullMQJobLogSink,
    runWithJobLogContext: mocks.runWithJobLogContext,
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

vi.mock("./executionLock.js", () => ({
    createExecutionLockRunner: vi.fn(() => ({
        using: mocks.executionLockUsing,
    })),
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
        mocks.executionLockUsing.mockImplementation(
            async (_resource, _durationMs, _shutdownSignal, routine) =>
                routine(new AbortController().signal),
        );
    });

    test("delegates enqueueing to BullMQClient and returns its job id", async () => {
        const manager = new BullMQJobManager({} as Redis);
        const workload = createWorkload();
        manager.register(workload);

        const result = await manager.trigger("connection-sync", data, {
            priority: 1,
        });

        expect(result).toBe("job-1");
        expect(mocks.enqueue).toHaveBeenCalledWith(workload.queueSpec, data, {
            priority: 1,
        });
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
            onStarted: vi.fn(async () => {
                calls.push("started");
            }),
            process: vi.fn(async () => {
                calls.push("processed");
                return { repoCount: 3 };
            }),
            onCompleted: vi.fn(async () => {
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
            }),
            { repoCount: 3 },
        );
        expect(
            vi.mocked(workload.onCompleted!).mock.calls[0][0],
        ).not.toHaveProperty("logger");
        await vi.waitFor(() => {
            expect(mocks.jobLogSink.flush).toHaveBeenCalledTimes(2);
        });
    });

    test("runs onStarted and processing while the execution lock is held", async () => {
        const calls: string[] = [];
        const workloadSignal = new AbortController().signal;
        mocks.executionLockUsing.mockImplementation(
            async (_resource, _durationMs, _shutdownSignal, routine) => {
                calls.push("lock-acquired");
                const result = await routine(workloadSignal);
                calls.push("lock-released");
                return result;
            },
        );
        const workload = createWorkload({
            executionLock: {
                resource: ({ connectionId }) =>
                    `sourcebot:lock:connection:${connectionId}`,
                durationMs: 60_000,
            },
            onStarted: vi.fn(async () => {
                calls.push("started");
            }),
            process: vi.fn(async ({ signal }) => {
                expect(signal).toBe(workloadSignal);
                calls.push("processed");
                return { repoCount: 3 };
            }),
        });
        const manager = new BullMQJobManager({} as Redis);
        manager.register(workload);
        await manager.start();

        await expect(
            mocks.workers[0].processor({ ...job, attemptsMade: 0 }),
        ).resolves.toEqual({ repoCount: 3 });

        expect(calls).toEqual([
            "lock-acquired",
            "started",
            "processed",
            "lock-released",
        ]);
        expect(mocks.executionLockUsing).toHaveBeenCalledWith(
            "sourcebot:lock:connection:42",
            60_000,
            expect.any(AbortSignal),
            expect.any(Function),
        );
        expect(mocks.logger.debug).toHaveBeenCalledWith(
            "Acquired workload execution lock",
            {
                resource: "sourcebot:lock:connection:42",
                lockWaitMs: expect.any(Number),
            },
        );
        expect(mocks.logger.debug).toHaveBeenCalledWith(
            "Finished work protected by execution lock",
            {
                resource: "sourcebot:lock:connection:42",
                lockHeldMs: expect.any(Number),
            },
        );
    });

    test("does not expose the internal job log sink to the workload processor", async () => {
        const process = vi.fn(
            async (context: ProcessContext<"connection-sync">) => {
                expect(context).not.toHaveProperty("logger");
                return { repoCount: 3 };
            },
        );
        const manager = new BullMQJobManager({} as Redis);
        manager.register(createWorkload({ process }));
        await manager.start();

        await mocks.workers[0].processor({ ...job, attemptsMade: 0 });

        expect(process).toHaveBeenCalledOnce();
        expect(mocks.jobLogSink.flush).toHaveBeenCalled();
    });

    test("reports lifecycle metadata after terminal failure", async () => {
        const onTerminalFailure = vi.fn(async () => undefined);
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
                }),
                error,
            );
        });
        expect(onTerminalFailure.mock.calls[0][0]).not.toHaveProperty(
            "logger",
        );
        await vi.waitFor(() => {
            expect(mocks.jobLogSink.flush).toHaveBeenCalledOnce();
        });
        expect(mocks.createBullMQJobLogSink).toHaveBeenCalledWith(
            expect.objectContaining({ id: "job-1", attemptsMade: 2 }),
            expect.objectContaining({ attempt: 2 }),
        );
    });
});
