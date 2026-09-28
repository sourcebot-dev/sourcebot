import type { DeduplicationOptions, KeepJobs } from "bullmq";
import { z, type ZodType } from "zod";
import {
    connectionSyncResultSchema,
    type ConnectionSyncResult,
} from "./connectionSync.js";
import { DEFAULT_JOB_LOGS_MAX_ENTRIES } from "./jobLogger.js";

interface BaseQueueSpec<TName extends QueueName> {
    name: TName;
    deduplication?(
        data: DataOf<TName>,
    ): Pick<DeduplicationOptions, "id" | "keepLastIfActive">;
    jobOptions: JobOptions;
}

type ResultSchemaSpec<TName extends QueueName> = TName extends QueueName
    ? [ResultOf<TName>] extends [void]
    ? { resultSchema?: never }
    : { resultSchema: ZodType<ResultOf<TName>> }
    : never;

export type QueueSpec<TName extends QueueName> = TName extends QueueName
    ? BaseQueueSpec<TName> & ResultSchemaSpec<TName>
    : never;

export type JobOptions = {
    attempts: number;
    backoff: {
        type: "fixed" | "exponential";
        delayMs: number;
        jitter?: number;
    };
    retention: JobRetention;
    keepLogs: number;
};

export type JobRetention =
    | {
        // Keeps the N most recently finished jobs in the queue (or those younger
        // than `age`), regardless of which resource they belong to.
        mode: "window";
        keepJobs: {
            completed: KeepJobs;
            failed: KeepJobs;
        };
    }
    | {
        // Keeps only the most recent job for each resource, keyed by the queue's
        // deduplication id. When a job starts, the job it supersedes is removed.
        // `maxAgeSeconds` is an age-only backstop that reclaims jobs whose
        // resource stopped running (e.g. a deleted repo). It must exceed the
        // longest scheduler interval, or a resource's latest job can be
        // reclaimed before its successor starts.
        mode: "latestPerResource";
        maxAgeSeconds: number;
    };

export type JobEnqueueOptions = {
    priority?: number;
};

export const JOB_PRIORITIES = {
    INTERACTIVE: 1,
    INITIAL: 5,
    SCHEDULED: 10,
} as const;

const ONE_DAY_IN_SECONDS = 24 * 60 * 60;
const ONE_WEEK_IN_SECONDS = 7 * ONE_DAY_IN_SECONDS;
const TWO_WEEKS_IN_SECONDS = 14 * ONE_DAY_IN_SECONDS;

export const DEFAULT_JOB_OPTIONS: JobOptions = {
    attempts: 2,
    backoff: {
        type: "exponential",
        delayMs: 30_000,
        jitter: 0.5,
    },
    retention: {
        mode: "window",
        keepJobs: {
            completed: {
                age: ONE_DAY_IN_SECONDS,
                count: 5_000,
            },
            failed: {
                age: TWO_WEEKS_IN_SECONDS,
                count: 10_000,
            },
        },
    },
    keepLogs: DEFAULT_JOB_LOGS_MAX_ENTRIES,
};

// For queues whose latest job per resource is resolved by the web app through
// a `latest...JobId` pointer. Window retention cannot guarantee that job
// survives, since the window is shared by every resource in the queue.
export const LATEST_PER_RESOURCE_JOB_OPTIONS: JobOptions = {
    ...DEFAULT_JOB_OPTIONS,
    retention: {
        mode: "latestPerResource",
        maxAgeSeconds: ONE_WEEK_IN_SECONDS,
    },
};

/**
 * Translates a queue's retention policy into BullMQ's per-job removal options.
 */
export const toBullMQKeepJobs = (
    retention: JobRetention,
): { completed: KeepJobs; failed: KeepJobs } => {
    if (retention.mode === "window") {
        return retention.keepJobs;
    }
    return {
        completed: { age: retention.maxAgeSeconds },
        failed: { age: retention.maxAgeSeconds },
    };
};

export type QueueName = keyof QueueRegistry;
export type DataOf<TName extends QueueName> = QueueRegistry[TName]["data"];
export type ResultOf<TName extends QueueName> = QueueRegistry[TName]["result"];

const attachmentPruneResultSchema = z.object({
    pendingClaimed: z.number().int().nonnegative(),
    committedClaimed: z.number().int().nonnegative(),
    reclaimed: z.number().int().nonnegative(),
});

const auditLogPruneResultSchema = z.object({
    deleted: z.number().int().nonnegative(),
});

const repoPermissionSyncResultSchema = z.object({
    repoName: z.string().min(1),
});

interface QueueRegistry {
    "attachment-prune": {
        data: Record<string, never>;
        result: z.infer<typeof attachmentPruneResultSchema>;
    };
    "audit-log-prune": {
        data: Record<string, never>;
        result: z.infer<typeof auditLogPruneResultSchema>;
    };
    "connection-sync": {
        data: {
            connectionId: number;
        };
        result: ConnectionSyncResult;
    };
    "repo-index": {
        data: {
            repoId: number;
        };
        result: void;
    };
    "repo-cleanup": {
        data: {
            repoId: number;
        };
        result: void;
    };
    "account-permission-sync": {
        data: {
            accountId: string;
        };
        result: void;
    };
    "repo-permission-sync": {
        data: {
            repoId: number;
        };
        result: z.infer<typeof repoPermissionSyncResultSchema>;
    };
}

export const ATTACHMENT_PRUNE_QUEUE: QueueSpec<"attachment-prune"> = {
    name: "attachment-prune",
    resultSchema: attachmentPruneResultSchema,
    jobOptions: DEFAULT_JOB_OPTIONS,
    deduplication: () => ({ id: "global" }),
};

export const AUDIT_LOG_PRUNE_QUEUE: QueueSpec<"audit-log-prune"> = {
    name: "audit-log-prune",
    resultSchema: auditLogPruneResultSchema,
    jobOptions: DEFAULT_JOB_OPTIONS,
    deduplication: () => ({ id: "global" }),
};

export const CONNECTION_QUEUE: QueueSpec<"connection-sync"> = {
    name: "connection-sync",
    resultSchema: connectionSyncResultSchema,
    jobOptions: LATEST_PER_RESOURCE_JOB_OPTIONS,
    deduplication: (data) => ({ id: `connection:${data.connectionId}` }),
};

export const REPO_INDEX_QUEUE: QueueSpec<"repo-index"> = {
    name: "repo-index",
    jobOptions: LATEST_PER_RESOURCE_JOB_OPTIONS,
    deduplication: ({ repoId }) => ({
        id: `repo:${repoId}`,
        keepLastIfActive: true,
    }),
};

export const REPO_CLEANUP_QUEUE: QueueSpec<"repo-cleanup"> = {
    name: "repo-cleanup",
    jobOptions: DEFAULT_JOB_OPTIONS,
    deduplication: ({ repoId }) => ({
        id: `repo:${repoId}`,
        keepLastIfActive: true,
    }),
};

export const ACCOUNT_PERMISSION_SYNC_QUEUE: QueueSpec<"account-permission-sync"> = {
    name: "account-permission-sync",
    jobOptions: LATEST_PER_RESOURCE_JOB_OPTIONS,
    deduplication: (data) => ({ id: `account:${data.accountId}` }),
};

export const REPO_PERMISSION_SYNC_QUEUE: QueueSpec<"repo-permission-sync"> = {
    name: "repo-permission-sync",
    resultSchema: repoPermissionSyncResultSchema,
    jobOptions: LATEST_PER_RESOURCE_JOB_OPTIONS,
    deduplication: (data) => ({ id: `repo:${data.repoId}` }),
};

export const QUEUE_SPECS = {
    [ATTACHMENT_PRUNE_QUEUE.name]: ATTACHMENT_PRUNE_QUEUE,
    [AUDIT_LOG_PRUNE_QUEUE.name]: AUDIT_LOG_PRUNE_QUEUE,
    [CONNECTION_QUEUE.name]: CONNECTION_QUEUE,
    [REPO_INDEX_QUEUE.name]: REPO_INDEX_QUEUE,
    [REPO_CLEANUP_QUEUE.name]: REPO_CLEANUP_QUEUE,
    [ACCOUNT_PERMISSION_SYNC_QUEUE.name]: ACCOUNT_PERMISSION_SYNC_QUEUE,
    [REPO_PERMISSION_SYNC_QUEUE.name]: REPO_PERMISSION_SYNC_QUEUE,
} as const satisfies { [TName in QueueName]: QueueSpec<TName> };
