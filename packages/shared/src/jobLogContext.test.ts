import { describe, expect, test, vi } from "vitest";
import type { JobLogSink } from "./jobLogger.js";
import { createLogger } from "./logger.js";
import {
    getJobLogContext,
    type JobLogContext,
    runWithJobLogContext,
} from "./jobLogContext.js";

vi.mock("./env.server.js", () => ({
    env: {
        SOURCEBOT_LOG_LEVEL: "debug",
        SOURCEBOT_STRUCTURED_LOGGING_ENABLED: "false",
    },
}));

const createSink = (): JobLogSink => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
});

const createContext = (
    jobId: string,
    sink = createSink(),
): JobLogContext => ({
    jobId,
    queueName: "connection-sync",
    attempt: 1,
    sink,
});

describe("jobLogContext", () => {
    test("returns undefined outside a job context", () => {
        expect(getJobLogContext()).toBeUndefined();
    });

    test("makes the context available across asynchronous work", async () => {
        const context = createContext("job-1");

        await runWithJobLogContext(context, async () => {
            await Promise.resolve();

            expect(getJobLogContext()).toBe(context);
        });

        expect(getJobLogContext()).toBeUndefined();
    });

    test("isolates concurrently running job contexts", async () => {
        const first = createContext("job-1");
        const second = createContext("job-2");

        await Promise.all([
            runWithJobLogContext(first, async () => {
                await Promise.resolve();
                expect(getJobLogContext()).toBe(first);
            }),
            runWithJobLogContext(second, async () => {
                await Promise.resolve();
                expect(getJobLogContext()).toBe(second);
            }),
        ]);
    });

    test("captures logs from application loggers in the active job", () => {
        const sink = createSink();
        const logger = createLogger("nested-service");
        logger.transports.forEach((transport) => {
            transport.silent = true;
        });

        runWithJobLogContext(createContext("job-1", sink), () => {
            logger.info("Fetched repository", { repoId: 42 });
        });

        expect(sink.info).toHaveBeenCalledWith("Fetched repository", {
            repoId: 42,
            source: "nested-service",
        });

        const error = new Error("boom");
        runWithJobLogContext(createContext("job-1", sink), () => {
            logger.error("Repository fetch failed", error);
        });
        expect(sink.error).toHaveBeenCalledWith(
            "Repository fetch failed boom",
            {
                details: error,
                source: "nested-service",
                stack: expect.stringContaining("Error: boom"),
            },
        );
        logger.close();
    });
});
