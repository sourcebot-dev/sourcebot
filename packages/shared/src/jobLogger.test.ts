import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
    const applicationError = vi.fn();
    return {
        applicationError,
        createLogger: vi.fn(() => ({ error: applicationError })),
    };
});

vi.mock("./logger.js", () => ({
    createLogger: mocks.createLogger,
}));

import {
    createBullMQJobLogSink,
    parseJobLogEntry,
    readBullMQJobLogs,
} from "./jobLogger.js";

beforeEach(() => {
    vi.clearAllMocks();
});

describe("createBullMQJobLogSink", () => {
    test("persists without writing a second application log", async () => {
        const log = vi.fn().mockResolvedValue(1);
        const sink = createBullMQJobLogSink({
            id: "job-1",
            name: "connection",
            queueName: "connection",
            attemptsMade: 0,
            log,
        });

        sink.info("Starting");
        await sink.flush();

        expect(log).toHaveBeenCalledOnce();
        expect(mocks.createLogger).not.toHaveBeenCalled();
    });

    test("writes structured, redacted entries to BullMQ", async () => {
        const log = vi.fn().mockResolvedValue(1);
        const sink = createBullMQJobLogSink({
            id: "job-1",
            name: "connection",
            queueName: "connection",
            attemptsMade: 1,
            log,
        });

        sink.warn("Some repositories were skipped", {
            skipped: 2,
            accessToken: "do-not-store",
        });
        await sink.flush();

        const storedEntry = JSON.parse(log.mock.calls[0][0]);
        expect(storedEntry).toMatchObject({
            version: 1,
            level: "warn",
            message: "Some repositories were skipped",
            attempt: 2,
            fields: {
                skipped: 2,
                accessToken: "[REDACTED]",
            },
        });
        expect(storedEntry.timestamp).toEqual(expect.any(String));
    });

    test("does not fail the workload when persisting a log entry fails", async () => {
        const sink = createBullMQJobLogSink({
            id: "job-1",
            name: "connection",
            queueName: "connection",
            attemptsMade: 0,
            log: vi.fn().mockRejectedValue(new Error("Redis unavailable")),
        });

        sink.info("Starting");
        await expect(sink.flush()).resolves.toBeUndefined();
        expect(mocks.applicationError).toHaveBeenCalled();
    });

    test("uses the supplied attempt for post-processing lifecycle logs", async () => {
        const log = vi.fn().mockResolvedValue(1);
        const sink = createBullMQJobLogSink(
            {
                id: "job-1",
                name: "connection",
                queueName: "connection",
                attemptsMade: 2,
                log,
            },
            { attempt: 2 },
        );

        sink.info("Completed");
        await sink.flush();

        expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ attempt: 2 });
    });
});

describe("readBullMQJobLogs", () => {
    test("parses structured entries and preserves legacy string logs", async () => {
        const structuredEntry = JSON.stringify({
            version: 1,
            timestamp: "2026-07-28T03:00:00.000Z",
            level: "info",
            message: "Started",
            attempt: 1,
        });
        const queue = {
            getJobLogs: vi.fn().mockResolvedValue({
                logs: [structuredEntry, "legacy log"],
                count: 2,
            }),
        };

        const result = await readBullMQJobLogs(queue, "job-1", {
            start: 10,
            end: 20,
            ascending: true,
        });

        expect(queue.getJobLogs).toHaveBeenCalledWith("job-1", 10, 20, true);
        expect(result).toEqual({
            logs: [
                parseJobLogEntry(structuredEntry),
                {
                    version: 0,
                    timestamp: null,
                    level: "info",
                    message: "legacy log",
                    attempt: null,
                },
            ],
            count: 2,
        });
    });
});
