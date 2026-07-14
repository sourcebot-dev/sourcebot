import { Connection, Repo, RepoToConnection } from "@sourcebot/db";
import { ConnectionConfig } from "@sourcebot/schemas/v3/connection.type";
import { Settings as SettingsSchema } from "@sourcebot/schemas/v3/index.type";

export type Settings = Required<SettingsSchema>;

// @see : https://stackoverflow.com/a/61132308
export type DeepPartial<T> = T extends object ? {
    [P in keyof T]?: DeepPartial<T[P]>;
} : T;

// @see: https://stackoverflow.com/a/69328045
export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

export type RepoWithConnections = Repo & { connections: (RepoToConnection & { connection: Connection })[] };


export type RepoAuthCredentials = {
    hostUrl?: string;
    token: string;
    cloneUrlWithToken?: string;
    authHeader?: string;
    /** The connection that configured the
     * credentials for this repo.
     */
    connectionConfig?: ConnectionConfig;
}

export interface QueueRegistry {
    'connection': {
        connectionId: number,
        orgId: number
    },
    'cron': {}
}

export type QueueName = keyof QueueRegistry;
export type DataOf<TName extends QueueName> = QueueRegistry[TName];

export interface ProcessContext<TName extends QueueName> {
    data: DataOf<TName>;
    jobId: string;
    attemptsMade: number;
    maxAttempts: number;
    signal: AbortSignal;
    log(message: string): Promise<void>;
    updateProgress(progress: number | object): Promise<void>;
    trigger<T extends QueueName>(workload: T, data: DataOf<T>): Promise<void>;
}

/**
 * A QueueSpec defines the specification for a queue, including
 * it's name, deduplication key, and settings.
 */
export interface QueueSpec<TName extends QueueName> {
    name: TName;
    dedupKey?(data: DataOf<TName>): string;
    jobOptions: {
        attempts: number;
        backoff: { type: 'fixed' | 'exponential'; delayMs: number };
        keep: { completed: number; failed: number };
    };
}

export type Schedule = { every: string } | { pattern: string };

/**
 * A Workload is a single kind of background work, declared
 * as the queue it runs on, the code that processes the job,
 * and how much of it may run at once.
 *
 * Jobs reach a workload's queue in one of two ways: someone calls `trigger`, or - if the
 * workload declares a `schedule` - the JobManager enqueues one on that cadence. A sweep is
 * just a scheduled workload that carries no payload, and whose `process` scans for work and
 * triggers it onto other workloads' queues.
 */
export interface Workload<TName extends QueueName, TResult = unknown> {
    spec: QueueSpec<TName>;
    concurrency: number;
    /**
     * If set, the JobManager enqueues a job on this cadence rather than waiting for someone to
     * `trigger` one. Scheduled jobs carry no payload, so `TData` should be `void`.
     */
    schedule?: Schedule;
    rateLimit?: { max: number; per: string };
    process(ctx: ProcessContext<TName>): Promise<TResult>;
    onTerminalFailure?(data: DataOf<TName>, err: Error): Promise<void>;
}

export interface JobManager {
    register<TName extends QueueName>(w: Workload<TName>): void;

    start(): Promise<void>;
    stop(): Promise<void>;

    trigger<TName extends QueueName>(
        workload: TName,
        data: DataOf<TName>
    ): Promise<void>;

    status(workload: string): Promise<QueueCounts>;
    jobDetail(workload: string, jobId: string): Promise<JobDetail | null>;
}



export interface QueueCounts {
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
    paused: number;
    prioritized?: number;
    'waiting-children'?: number;
}

export interface JobDetail<TData = unknown, TResult = unknown> {
    id: string;
    name: string;
    state: 'waiting' | 'active' | 'delayed' | 'completed' | 'failed' | 'paused' | 'unknown';
    data: TData;
    attemptsMade: number;
    maxAttempts: number;
    result?: TResult | null;
    failedReason?: string | null;
    stacktrace?: string[];
    logs: string[];
    enqueuedAt: number;
    startedAt: number | null;
    finishedAt: number | null;
    waitMs?: number | null;
    runMs?: number | null;
}
