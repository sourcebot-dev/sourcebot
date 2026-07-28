import type { Job, Queue } from "bullmq";
import { createLogger } from "./logger.js";

export const DEFAULT_JOB_LOGS_MAX_ENTRIES = 500;

export type JobLogLevel = "debug" | "info" | "warn" | "error";
export type JobLogFields = Record<string, unknown>;

export interface JobLogEntry {
    version: 1 | 0;
    timestamp: string | null;
    level: JobLogLevel;
    message: string;
    attempt: number | null;
    fields?: JobLogFields;
}

export interface JobLogSink {
    debug(message: string, fields?: unknown): void;
    info(message: string, fields?: unknown): void;
    warn(message: string, fields?: unknown): void;
    error(message: string, fields?: unknown): void;
}

export interface JobLogger extends JobLogSink {
    flush(): Promise<void>;
}

export interface GetJobLogsOptions {
    start?: number;
    end?: number;
    ascending?: boolean;
}

export interface JobLogs {
    logs: JobLogEntry[];
    count: number;
}

type BullMQLogJob = Pick<Job, "id" | "name" | "queueName" | "attemptsMade" | "log">;
type JobLogQueue = Pick<Queue, "getJobLogs">;

const JOB_LOG_LEVELS = new Set<JobLogLevel>(["debug", "info", "warn", "error"]);
const SENSITIVE_FIELD_NAME = /authorization|cookie|credential|password|private.?key|secret|token/i;
const MAX_FIELD_DEPTH = 6;

const sanitizeValue = (
    value: unknown,
    seen: WeakSet<object>,
    depth: number,
): unknown => {
    if (depth > MAX_FIELD_DEPTH) {
        return "[Max depth reached]";
    }
    if (
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
    ) {
        return value;
    }
    if (typeof value === "bigint") {
        return value.toString();
    }
    if (typeof value === "undefined") {
        return "[undefined]";
    }
    if (typeof value === "symbol" || typeof value === "function") {
        return String(value);
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (value instanceof Error) {
        return {
            name: value.name,
            message: value.message,
            stack: value.stack,
        };
    }
    if (seen.has(value)) {
        return "[Circular]";
    }

    seen.add(value);
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeValue(item, seen, depth + 1));
    }

    return Object.fromEntries(
        Object.entries(value).map(([key, nestedValue]) => [
            key,
            SENSITIVE_FIELD_NAME.test(key)
                ? "[REDACTED]"
                : sanitizeValue(nestedValue, seen, depth + 1),
        ]),
    );
};

const sanitizeFields = (fields: unknown): JobLogFields | undefined => {
    if (fields === undefined) {
        return undefined;
    }

    const sanitized = sanitizeValue(fields, new WeakSet(), 0);
    if (sanitized !== null && typeof sanitized === "object" && !Array.isArray(sanitized)) {
        return sanitized as JobLogFields;
    }
    return { value: sanitized };
};

export const parseJobLogEntry = (rawLog: string): JobLogEntry => {
    try {
        const parsed = JSON.parse(rawLog) as Partial<JobLogEntry>;
        if (
            parsed.version === 1 &&
            typeof parsed.timestamp === "string" &&
            typeof parsed.level === "string" &&
            JOB_LOG_LEVELS.has(parsed.level as JobLogLevel) &&
            typeof parsed.message === "string" &&
            typeof parsed.attempt === "number"
        ) {
            return {
                version: 1,
                timestamp: parsed.timestamp,
                level: parsed.level as JobLogLevel,
                message: parsed.message,
                attempt: parsed.attempt,
                ...(parsed.fields ? { fields: parsed.fields } : {}),
            };
        }
    } catch {
        // Older BullMQ logs were stored as plain strings.
    }

    return {
        version: 0,
        timestamp: null,
        level: "info",
        message: rawLog,
        attempt: null,
    };
};

export const readBullMQJobLogs = async (
    queue: JobLogQueue,
    jobId: string,
    options: GetJobLogsOptions = {},
): Promise<JobLogs> => {
    const result = await queue.getJobLogs(
        jobId,
        options.start,
        options.end,
        options.ascending,
    );

    return {
        logs: result.logs.map(parseJobLogEntry),
        count: result.count,
    };
};

export const createBullMQJobLogger = (
    job: BullMQLogJob,
    label = `${job.queueName}:job:${job.id ?? "unknown"}`,
): JobLogger => {
    const applicationLogger = createLogger(label);
    const pendingWrites = new Set<Promise<void>>();

    const write = (level: JobLogLevel, message: string, rawFields?: unknown): void => {
        const fields = sanitizeFields(rawFields);
        applicationLogger.log(level, message, fields);

        const entry: JobLogEntry = {
            version: 1,
            timestamp: new Date().toISOString(),
            level,
            message,
            attempt: job.attemptsMade + 1,
            ...(fields ? { fields } : {}),
        };
        const pendingWrite = job.log(JSON.stringify(entry))
            .then(() => undefined)
            .catch((error: unknown) => {
                applicationLogger.error(
                    `Failed to persist a BullMQ log entry for job ${job.id ?? "unknown"}`,
                    error,
                );
            });

        pendingWrites.add(pendingWrite);
        void pendingWrite.finally(() => {
            pendingWrites.delete(pendingWrite);
        });
    };

    return {
        debug: (message, fields) => write("debug", message, fields),
        info: (message, fields) => write("info", message, fields),
        warn: (message, fields) => write("warn", message, fields),
        error: (message, fields) => write("error", message, fields),
        flush: async () => {
            await Promise.all([...pendingWrites]);
        },
    };
};
