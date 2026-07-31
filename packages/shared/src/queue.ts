
import { ConnectionSyncJobStatus, PrismaClient, RepoIndexingJobStatus, RepoIndexingJobType } from "@sourcebot/db";
import { DEFAULT_JOB_LOGS_MAX_ENTRIES } from "./jobLogger.js";

export type QueueName = keyof QueueRegistry;
export type DataOf<TName extends QueueName> = QueueRegistry[TName];
type EmptyJobData = Record<string, never>;

interface QueueRegistry {
    'reconciliation': EmptyJobData,
    'connection-sync': {
        connectionId: number,
        orgId: number
    },
    'repo-index': {
        repoId: number,
        type: 'INDEX' | 'CLEANUP',
    },
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

export const CONNECTION_QUEUE: QueueSpec<'connection-sync'> = {
    name: 'connection-sync',
    jobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delayMs: 5000 },
        keep: { completed: 50, failed: 50 },
        keepLogs: DEFAULT_JOB_LOGS_MAX_ENTRIES,
    },
    dedupKey: (data) => `connection:${data.connectionId}`,
    onEnqueued: async ({ prisma, data: { connectionId }, jobId }) => {
        await prisma.connectionSyncJob.upsert({
            where: {
                id: jobId,
            },
            update: {},
            create: {
                id: jobId,
                connectionId,
                status: ConnectionSyncJobStatus.PENDING,
                warningMessages: [],
            },
        });
    }
};

export const REPO_INDEX_QUEUE: QueueSpec<'repo-index'> = {
    name: 'repo-index',
    jobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delayMs: 5000 },
        keep: { completed: 50, failed: 50 },
        keepLogs: DEFAULT_JOB_LOGS_MAX_ENTRIES,
    },
    dedupKey: (data) => `repo:${data.repoId}`,
    onEnqueued: async ({ prisma, data: { repoId, type }, jobId }) => {
        await prisma.repoIndexingJob.upsert({
            where: {
                id: jobId,
            },
            update: {},
            create: {
                id: jobId,
                repoId,
                type: RepoIndexingJobType[type],
                status: RepoIndexingJobStatus.PENDING,
            },
        });
    },
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
