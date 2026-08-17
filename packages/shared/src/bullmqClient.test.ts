import { Redis } from "ioredis";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    add: vi.fn(async () => ({ id: "job-1" })),
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
        mocks.getJobScheduler.mockResolvedValue(undefined);
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
                    attempts: 4,
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
                attempts: 4,
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
                    attempts: 4,
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
                    attempts: 4,
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
