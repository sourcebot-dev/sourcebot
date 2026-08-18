import type { KeepJobs } from "bullmq";
import { z, type ZodType } from "zod";
import {
    connectionSyncResultSchema,
    type ConnectionSyncResult,
} from "./connectionSync.js";
import { DEFAULT_JOB_LOGS_MAX_ENTRIES } from "./jobLogger.js";

interface BaseQueueSpec<TName extends QueueName> {
    name: TName;
    dedupKey?(data: DataOf<TName>): string;
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
    keepJobs: {
        completed: KeepJobs;
        failed: KeepJobs;
    };
    keepLogs: number;
};

export type JobEnqueueOptions = {
    priority?: number;
};

export const JOB_PRIORITIES = {
    INTERACTIVE: 1,
    INITIAL: 5,
    SCHEDULED: 10,
} as const;

const TWO_WEEKS_IN_SECONDS = 14 * 24 * 60 * 60;

export const DEFAULT_JOB_OPTIONS: JobOptions = {
    attempts: 4,
    backoff: {
        type: "exponential",
        delayMs: 30_000,
        jitter: 0.5,
    },
    keepJobs: {
        completed: { age: TWO_WEEKS_IN_SECONDS },
        failed: { age: TWO_WEEKS_IN_SECONDS },
    },
    keepLogs: DEFAULT_JOB_LOGS_MAX_ENTRIES,
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
            type: "INDEX" | "CLEANUP";
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
    dedupKey: () => "global",
};

export const AUDIT_LOG_PRUNE_QUEUE: QueueSpec<"audit-log-prune"> = {
    name: "audit-log-prune",
    resultSchema: auditLogPruneResultSchema,
    jobOptions: DEFAULT_JOB_OPTIONS,
    dedupKey: () => "global",
};

export const CONNECTION_QUEUE: QueueSpec<"connection-sync"> = {
    name: "connection-sync",
    resultSchema: connectionSyncResultSchema,
    jobOptions: DEFAULT_JOB_OPTIONS,
    dedupKey: (data) => `connection:${data.connectionId}`,
};

export const REPO_INDEX_QUEUE: QueueSpec<"repo-index"> = {
    name: "repo-index",
    jobOptions: DEFAULT_JOB_OPTIONS,
};

export const ACCOUNT_PERMISSION_SYNC_QUEUE: QueueSpec<"account-permission-sync"> = {
    name: "account-permission-sync",
    jobOptions: DEFAULT_JOB_OPTIONS,
    dedupKey: (data) => `account:${data.accountId}`,
};

export const REPO_PERMISSION_SYNC_QUEUE: QueueSpec<"repo-permission-sync"> = {
    name: "repo-permission-sync",
    resultSchema: repoPermissionSyncResultSchema,
    jobOptions: DEFAULT_JOB_OPTIONS,
    dedupKey: (data) => `repo:${data.repoId}`,
};
