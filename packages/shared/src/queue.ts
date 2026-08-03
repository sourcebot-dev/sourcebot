import { DEFAULT_JOB_LOGS_MAX_ENTRIES } from "./jobLogger.js";

export type QueueName = keyof QueueRegistry;
export type DataOf<TName extends QueueName> = QueueRegistry[TName];
type EmptyJobData = Record<string, never>;

interface QueueRegistry {
    reconciliation: EmptyJobData;
    "connection-sync": {
        connectionId: number;
        orgId: number;
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

export const RECONCILIATION_QUEUE: QueueSpec<"reconciliation"> = {
    name: "reconciliation",
    jobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delayMs: 5000 },
        keep: { completed: 50, failed: 50 },
        keepLogs: DEFAULT_JOB_LOGS_MAX_ENTRIES,
    },
};

export const CONNECTION_QUEUE: QueueSpec<"connection-sync"> = {
    name: "connection-sync",
    jobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delayMs: 5000 },
        keep: { completed: 50, failed: 50 },
        keepLogs: DEFAULT_JOB_LOGS_MAX_ENTRIES,
    },
    dedupKey: (data) => `connection:${data.connectionId}`,
};

export const REPO_INDEX_QUEUE: QueueSpec<"repo-index"> = {
    name: "repo-index",
    jobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delayMs: 5000 },
        keep: { completed: 50, failed: 50 },
        keepLogs: DEFAULT_JOB_LOGS_MAX_ENTRIES,
    },
    dedupKey: (data) => `repo:${data.repoId}`,
};

export const ACCOUNT_PERMISSION_SYNC_QUEUE: QueueSpec<"account-permission-sync"> =
    {
        name: "account-permission-sync",
        jobOptions: {
            attempts: 2,
            backoff: { type: "exponential", delayMs: 5000 },
            keep: { completed: 50, failed: 50 },
            keepLogs: DEFAULT_JOB_LOGS_MAX_ENTRIES,
        },
        dedupKey: (data) => `account:${data.accountId}`,
    };

export const REPO_PERMISSION_SYNC_QUEUE: QueueSpec<"repo-permission-sync"> = {
    name: "repo-permission-sync",
    jobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delayMs: 5000 },
        keep: { completed: 50, failed: 50 },
        keepLogs: DEFAULT_JOB_LOGS_MAX_ENTRIES,
    },
    dedupKey: (data) => `repo:${data.repoId}`,
};

export interface QueueSpec<TName extends QueueName> {
    name: TName;
    dedupKey?(data: DataOf<TName>): string;
    jobOptions: {
        attempts: number;
        backoff: { type: "fixed" | "exponential"; delayMs: number };
        keep: { completed: number; failed: number };
        keepLogs: number;
    };
}
