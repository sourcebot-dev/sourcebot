import { Redis } from "ioredis";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    add: vi.fn(async () => ({ id: "job-1" })),
    getJob: vi.fn(),
    listJobs: vi.fn(),
    upsertJobScheduler: vi.fn(async () => ({ id: "scheduled-job" })),
    getJobScheduler: vi.fn(),
    getJobSchedulers: vi.fn(async () => [
        { key: "scheduler-1" },
        { key: "scheduler-2" },
    ]),
    removeJobScheduler: vi.fn(async () => true),
}));

vi.mock("bullmq", () => ({
    Queue: class {
        add = mocks.add;
        getJob = mocks.getJob;
        getJobs = mocks.listJobs;
        upsertJobScheduler = mocks.upsertJobScheduler;
        getJobScheduler = mocks.getJobScheduler;
        getJobSchedulers = mocks.getJobSchedulers;
        removeJobScheduler = mocks.removeJobScheduler;
    },
}));

vi.mock("./jobLogger.js", () => ({
    DEFAULT_JOB_LOGS_MAX_ENTRIES: 500,
    readBullMQJobLogs: vi.fn(),
}));

import { BullMQClient } from "./bullmqClient.js";
import { CONNECTION_QUEUE } from "./queue.js";

describe("BullMQClient", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        vi.spyOn(Date, "now").mockReturnValue(1_000_000);
        mocks.getJob.mockResolvedValue(undefined);
        mocks.listJobs.mockResolvedValue([]);
        mocks.getJobScheduler.mockResolvedValue(undefined);
    });

    test("gets jobs by id and preserves missing jobs", async () => {
        mocks.getJob.mockImplementation(async (jobId: string) => {
            if (jobId === "job-1") {
                return {
                    id: jobId,
                    data: { connectionId: 1 },
                    failedReason: "",
                    returnvalue: null,
                    getState: vi.fn(async () => "active"),
                };
            }
            if (jobId === "job-2") {
                return {
                    id: jobId,
                    data: { connectionId: 2 },
                    failedReason: "",
                    returnvalue: { outcome: "SUCCESS" },
                    getState: vi.fn(async () => "completed"),
                };
            }
            return undefined;
        });
        const client = new BullMQClient({} as Redis);

        await expect(
            client.getJobs(CONNECTION_QUEUE, ["job-1", "missing", "job-2"]),
        ).resolves.toEqual(new Map([
            ["job-1", {
                id: "job-1",
                data: { connectionId: 1 },
                status: "IN_PROGRESS",
                errorMessage: null,
                result: null,
            }],
            ["missing", null],
            ["job-2", {
                id: "job-2",
                data: { connectionId: 2 },
                status: "COMPLETED",
                errorMessage: null,
                result: { outcome: "SUCCESS" },
            }],
        ]));
    });

    test("returns null for an unrecognized legacy connection result", async () => {
        mocks.getJob.mockResolvedValue({
            id: "job-1",
            data: { connectionId: 1 },
            failedReason: "",
            returnvalue: {
                reposToCleanup: [],
                reposToIndex: [],
            },
            getState: vi.fn(async () => "completed"),
        });
        const client = new BullMQClient({} as Redis);

        await expect(
            client.getJob(CONNECTION_QUEUE, "job-1"),
        ).resolves.toEqual({
            id: "job-1",
            data: { connectionId: 1 },
            status: "COMPLETED",
            errorMessage: null,
            result: null,
        });
    });

    test("deduplicates job ids when getting jobs", async () => {
        mocks.getJob.mockResolvedValue({
            id: "job-1",
            data: { connectionId: 1 },
            failedReason: "",
            returnvalue: null,
            getState: vi.fn(async () => "waiting"),
        });
        const client = new BullMQClient({} as Redis);

        const jobs = await client.getJobs(CONNECTION_QUEUE, [
            "job-1",
            "job-1",
        ]);

        expect(jobs).toHaveLength(1);
        expect(mocks.getJob).toHaveBeenCalledTimes(1);
    });

    test("lists failed job ids", async () => {
        mocks.listJobs.mockResolvedValue([
            { id: "failed-1" },
            { id: "failed-2" },
        ]);
        const client = new BullMQClient({} as Redis);

        await expect(
            client.getFailedJobIds(CONNECTION_QUEUE),
        ).resolves.toEqual(["failed-1", "failed-2"]);
        expect(mocks.listJobs).toHaveBeenCalledWith(
            ["failed"],
            0,
            -1,
            true,
        );
    });

    test("includes workload data in scheduled jobs", async () => {
        const client = new BullMQClient({} as Redis);
        const data = { connectionId: 42 };

        await client.upsertJobScheduler(
            CONNECTION_QUEUE,
            "schedule:42",
            1_000,
            data,
        );

        expect(mocks.upsertJobScheduler).toHaveBeenCalledWith(
            "schedule:42",
            { every: 1_000, startDate: 1_001_000 },
            expect.objectContaining({
                name: "connection-sync",
                data,
                opts: {
                    attempts: 2,
                    backoff: {
                        type: "exponential",
                        delay: 30_000,
                        jitter: 0.5,
                    },
                    removeOnComplete: { age: 1_209_600 },
                    removeOnFail: { age: 1_209_600 },
                    keepLogs: 500,
                },
            }),
        );
    });

    test("adds enqueue priority to immediate jobs", async () => {
        const client = new BullMQClient({} as Redis);

        await client.enqueue(
            CONNECTION_QUEUE,
            { connectionId: 42 },
            { priority: 1 },
        );

        expect(mocks.add).toHaveBeenCalledWith(
            "connection-sync",
            { connectionId: 42 },
            expect.objectContaining({
                priority: 1,
                attempts: 2,
                backoff: {
                    type: "exponential",
                    delay: 30_000,
                    jitter: 0.5,
                },
            }),
        );
    });

    test("adds enqueue priority to scheduled jobs", async () => {
        const client = new BullMQClient({} as Redis);

        await client.upsertJobScheduler(
            CONNECTION_QUEUE,
            "schedule:42",
            1_000,
            { connectionId: 42 },
            { priority: 10 },
        );

        expect(mocks.upsertJobScheduler).toHaveBeenCalledWith(
            "schedule:42",
            expect.any(Object),
            expect.objectContaining({
                opts: expect.objectContaining({ priority: 10 }),
            }),
        );
    });

    test("does not update an unchanged job scheduler", async () => {
        mocks.getJobScheduler.mockResolvedValue({
            key: "schedule:42",
            name: "connection-sync",
            every: 1_000,
            startDate: 500_000,
            next: 1_000_500,
            template: {
                data: { connectionId: 42 },
                opts: {
                    priority: 10,
                    attempts: 2,
                    backoff: {
                        type: "exponential",
                        delay: 30_000,
                        jitter: 0.5,
                    },
                    removeOnComplete: { age: 1_209_600 },
                    removeOnFail: { age: 1_209_600 },
                    keepLogs: 500,
                },
            },
        });
        const client = new BullMQClient({} as Redis);

        await expect(
            client.upsertJobScheduler(
                CONNECTION_QUEUE,
                "schedule:42",
                1_000,
                { connectionId: 42 },
                { priority: 10 },
            ),
        ).resolves.toBe("repeat:schedule:42:1000500");

        expect(mocks.getJobScheduler).toHaveBeenCalledWith("schedule:42");
        expect(mocks.upsertJobScheduler).not.toHaveBeenCalled();
    });

    test("updates a job scheduler when its interval changes", async () => {
        mocks.getJobScheduler.mockResolvedValue({
            key: "schedule:42",
            name: "connection-sync",
            every: 500,
            next: 1_000_500,
            template: {
                data: { connectionId: 42 },
                opts: {
                    attempts: 2,
                    backoff: {
                        type: "exponential",
                        delay: 30_000,
                        jitter: 0.5,
                    },
                    removeOnComplete: { age: 1_209_600 },
                    removeOnFail: { age: 1_209_600 },
                    keepLogs: 500,
                },
            },
        });
        const client = new BullMQClient({} as Redis);

        await client.upsertJobScheduler(
            CONNECTION_QUEUE,
            "schedule:42",
            1_000,
            { connectionId: 42 },
        );

        expect(mocks.upsertJobScheduler).toHaveBeenCalledWith(
            "schedule:42",
            { every: 1_000, startDate: 1_001_000 },
            expect.any(Object),
        );
    });

    test("parses string schedules and delays the first run by one interval", async () => {
        const client = new BullMQClient({} as Redis);

        await client.upsertJobScheduler(CONNECTION_QUEUE, "schedule:42", "5m", {
            connectionId: 42,
        });

        expect(mocks.upsertJobScheduler).toHaveBeenCalledWith(
            "schedule:42",
            { every: 300_000, startDate: 1_300_000 },
            expect.any(Object),
        );
    });

    test("lists scheduler ids", async () => {
        const client = new BullMQClient({} as Redis);

        await expect(
            client.getJobSchedulerIds(CONNECTION_QUEUE),
        ).resolves.toEqual(["scheduler-1", "scheduler-2"]);
    });

    test("removes a scheduler by id", async () => {
        const client = new BullMQClient({} as Redis);

        await expect(
            client.removeJobScheduler(CONNECTION_QUEUE, "scheduler-1"),
        ).resolves.toBe(true);
        expect(mocks.removeJobScheduler).toHaveBeenCalledWith("scheduler-1");
    });
});
