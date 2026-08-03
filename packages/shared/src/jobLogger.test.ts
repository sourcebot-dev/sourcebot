import { describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    applicationLog: vi.fn(),
    applicationError: vi.fn(),
}));

vi.mock("./logger.js", () => ({
    createLogger: vi.fn(() => ({
        log: mocks.applicationLog,
        error: mocks.applicationError,
    })),
}));

import {
    createBullMQJobLogger,
    parseJobLogEntry,
    readBullMQJobLogs,
} from "./jobLogger.js";

describe("createBullMQJobLogger", () => {
    test("writes structured, redacted entries to BullMQ and the application logger", async () => {
        const log = vi.fn().mockResolvedValue(1);
        const logger = createBullMQJobLogger({
            id: "job-1",
            name: "connection",
            queueName: "connection",
            attemptsMade: 1,
            log,
        });

        logger.warn("Some repositories were skipped", {
            skipped: 2,
            accessToken: "do-not-store",
        });
        await logger.flush();

        expect(mocks.applicationLog).toHaveBeenCalledWith(
            "warn",
            "Some repositories were skipped",
            {
                skipped: 2,
                accessToken: "[REDACTED]",
            },
        );

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
        const logger = createBullMQJobLogger({
            id: "job-1",
            name: "connection",
            queueName: "connection",
            attemptsMade: 0,
            log: vi.fn().mockRejectedValue(new Error("Redis unavailable")),
        });

        logger.info("Starting");
        await expect(logger.flush()).resolves.toBeUndefined();
        expect(mocks.applicationError).toHaveBeenCalled();
    });

    test("uses the supplied attempt for post-processing lifecycle logs", async () => {
        const log = vi.fn().mockResolvedValue(1);
        const logger = createBullMQJobLogger(
            {
                id: "job-1",
                name: "connection",
                queueName: "connection",
                attemptsMade: 2,
                log,
            },
            { attempt: 2 },
        );

        logger.info("Completed");
        await logger.flush();

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
