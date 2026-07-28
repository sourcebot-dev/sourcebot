import { Connection, Repo, RepoToConnection } from "@sourcebot/db";
import { ConnectionConfig } from "@sourcebot/schemas/v3/connection.type";
import { Settings as SettingsSchema } from "@sourcebot/schemas/v3/index.type";
import { DataOf, JobLifecycleContext, JobLogger, QueueName, QueueSpec } from "@sourcebot/shared";

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
    connectionConfig?: ConnectionConfig;
}


export interface ProcessContext<TName extends QueueName> extends JobLifecycleContext<TName> {
    signal: AbortSignal;
    logger: JobLogger;
    updateProgress(progress: number | object): Promise<void>;
    trigger<T extends QueueName>(workload: T, data: DataOf<T>): Promise<string>;
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
    queueSpec: QueueSpec<TName>;
    concurrency: number;
    /**
     * If set, the JobManager enqueues a job on this cadence rather than waiting for someone to
     * `trigger` one. Scheduled jobs carry no payload, so `TData` should be `void`.
     */
    schedule?: Schedule;
    rateLimit?: { max: number; per: string };
    process(ctx: ProcessContext<TName>): Promise<TResult>;
    /** Called before `process` on every attempt. */
    onStarted?(ctx: JobLifecycleContext<TName>): Promise<void>;
    /** Called after BullMQ marks the job as completed. */
    onCompleted?(ctx: JobLifecycleContext<TName>, result: TResult): Promise<void>;
    /** Called after BullMQ exhausts all attempts and marks the job as failed. */
    onTerminalFailure?(ctx: JobLifecycleContext<TName>, err: Error): Promise<void>;
}

export interface JobManager {
    register<TName extends QueueName>(w: Workload<TName>): void;

    start(): Promise<void>;
    stop(): Promise<void>;

    trigger<TName extends QueueName>(
        workload: TName,
        data: DataOf<TName>
    ): Promise<string>;
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
