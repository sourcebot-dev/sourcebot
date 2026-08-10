import type { KeepJobs } from "bullmq";
import { DEFAULT_JOB_LOGS_MAX_ENTRIES } from "./jobLogger.js";

export interface QueueSpec<TName extends QueueName> {
    name: TName;
    dedupKey?(data: DataOf<TName>): string;
    jobOptions: JobOptions;
}

export type JobOptions = {
    attempts: number;
    backoff: { type: "fixed" | "exponential"; delayMs: number };
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
    SCHEDULED: 10,
} as const;

const TWO_WEEKS_IN_SECONDS = 14 * 24 * 60 * 60;

export const DEFAULT_JOB_OPTIONS: JobOptions = {
    attempts: 2,
    backoff: { type: "exponential", delayMs: 5000 },
    keepJobs: {
        completed: { age: TWO_WEEKS_IN_SECONDS },
        failed: { age: TWO_WEEKS_IN_SECONDS },
    },
    keepLogs: DEFAULT_JOB_LOGS_MAX_ENTRIES,
};

export type QueueName = keyof QueueRegistry;
export type DataOf<TName extends QueueName> = QueueRegistry[TName];

interface QueueRegistry {
    "attachment-prune": Record<string, never>;
    "audit-log-prune": Record<string, never>;
    "connection-sync": {
        connectionId: number;
    };
    "repo-index": {
        repoId: number;
        type: "INDEX" | "CLEANUP";
    };
    "account-permission-sync": {
        accountId: string;
    };
    "repo-permission-sync": {
        repoId: number;
    };
}

export const ATTACHMENT_PRUNE_QUEUE: QueueSpec<"attachment-prune"> = {
    name: "attachment-prune",
    jobOptions: DEFAULT_JOB_OPTIONS,
    dedupKey: () => "global",
};

export const AUDIT_LOG_PRUNE_QUEUE: QueueSpec<"audit-log-prune"> = {
    name: "audit-log-prune",
    jobOptions: DEFAULT_JOB_OPTIONS,
    dedupKey: () => "global",
};

export const CONNECTION_QUEUE: QueueSpec<"connection-sync"> = {
    name: "connection-sync",
    jobOptions: DEFAULT_JOB_OPTIONS,
    dedupKey: (data) => `connection:${data.connectionId}`,
};

export const REPO_INDEX_QUEUE: QueueSpec<"repo-index"> = {
    name: "repo-index",
    jobOptions: DEFAULT_JOB_OPTIONS,
    dedupKey: (data) => `repo:${data.repoId}`,
};

export const ACCOUNT_PERMISSION_SYNC_QUEUE: QueueSpec<"account-permission-sync"> =
    {
        name: "account-permission-sync",
        jobOptions: DEFAULT_JOB_OPTIONS,
        dedupKey: (data) => `account:${data.accountId}`,
    };

export const REPO_PERMISSION_SYNC_QUEUE: QueueSpec<"repo-permission-sync"> = {
    name: "repo-permission-sync",
    jobOptions: DEFAULT_JOB_OPTIONS,
    dedupKey: (data) => `repo:${data.repoId}`,
};
