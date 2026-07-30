
import { PrismaClient } from "@sourcebot/db";
import { DEFAULT_JOB_LOGS_MAX_ENTRIES } from "./jobLogger.js";

export type QueueName = keyof QueueRegistry;
export type DataOf<TName extends QueueName> = QueueRegistry[TName];
type EmptyJobData = Record<string, never>;

interface QueueRegistry {
    'connection': {
        connectionId: number,
        orgId: number
    },
    'reconciliation': EmptyJobData,
    'repo-index': {
        repoId: number,
        type: 'INDEX' | 'CLEANUP',
    },
}

export const CONNECTION_QUEUE: QueueSpec<'connection'> = {
    name: 'connection',
    jobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delayMs: 5000 },
        keep: { completed: 50, failed: 50 },
        keepLogs: DEFAULT_JOB_LOGS_MAX_ENTRIES,
    },
    onEnqueued: async ({
        prisma,
        data: { connectionId },
        jobId
    }) => {
        await prisma.connection.update({
            where: {
                id: connectionId
            },
            data: {
                latestSyncJobId: jobId
            }
        });
    },
    dedupKey: (data) => `connection:${data.connectionId}`,
}


export const RECONCILIATION_QUEUE: QueueSpec<'reconciliation'> = {
    name: 'reconciliation',
    jobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delayMs: 5000 },
        keep: { completed: 50, failed: 50 },
        keepLogs: DEFAULT_JOB_LOGS_MAX_ENTRIES,
    },
};

export const REPO_INDEX_QUEUE: QueueSpec<'repo-index'> = {
    name: 'repo-index',
    jobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delayMs: 5000 },
        keep: { completed: 50, failed: 50 },
        keepLogs: DEFAULT_JOB_LOGS_MAX_ENTRIES,
    },
    onEnqueued: async ({
        prisma,
        data: { repoId },
        jobId,
    }) => {
        await prisma.repo.update({
            where: {
                id: repoId,
            },
            data: {
                latestIndexingJobId: jobId,
            },
        });
    },
    dedupKey: (data) => `repo:${data.repoId}`,
};

export interface QueueSpec<TName extends QueueName> {
    name: TName;
    dedupKey?(data: DataOf<TName>): string;
    jobOptions: {
        attempts: number;
        backoff: { type: 'fixed' | 'exponential'; delayMs: number };
        keep: { completed: number; failed: number };
        keepLogs: number;
    };
    onEnqueued?(ctx: JobLifecycleContext<TName>): Promise<void>;
}

export interface JobLifecycleContext<TName extends QueueName> {
    data: DataOf<TName>;
    jobId: string;
    attemptsMade: number;
    maxAttempts: number;
    prisma: PrismaClient;
}
