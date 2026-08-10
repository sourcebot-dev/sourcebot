import {
    Connection,
    PrismaClient,
    Repo,
    RepoToConnection,
} from "@sourcebot/db";
import { ConnectionConfig } from "@sourcebot/schemas/v3/connection.type";
import { Settings as SettingsSchema } from "@sourcebot/schemas/v3/index.type";
import {
    DataOf,
    JobEnqueueOptions,
    JobLogSink,
    QueueName,
    QueueSpec,
    Schedule,
} from "@sourcebot/shared";
import type { Queue } from "bullmq";

export type Settings = Required<SettingsSchema>;

// @see : https://stackoverflow.com/a/61132308
export type DeepPartial<T> = T extends object
    ? {
          [P in keyof T]?: DeepPartial<T[P]>;
      }
    : T;

// @see: https://stackoverflow.com/a/69328045
export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

export type RepoWithConnections = Repo & {
    connections: (RepoToConnection & { connection: Connection })[];
};

export type RepoAuthCredentials = {
    hostUrl?: string;
    token: string;
    cloneUrlWithToken?: string;
    authHeader?: string;
    connectionConfig?: ConnectionConfig;
};

export interface JobLifecycleContext<TName extends QueueName> {
    data: DataOf<TName>;
    jobId: string;
    attemptsMade: number;
    maxAttempts: number;
    prisma: PrismaClient;
    logger: JobLogSink;
}

export interface ProcessContext<TName extends QueueName>
    extends JobLifecycleContext<TName> {
    signal: AbortSignal;
    updateProgress(progress: number | object): Promise<void>;
    trigger<T extends QueueName>(
        workload: T,
        data: DataOf<T>,
        options?: JobEnqueueOptions,
    ): Promise<string>;
}

export interface Workload<TName extends QueueName, TResult = unknown> {
    queueSpec: QueueSpec<TName>;
    concurrency: number;
    schedule?: {
        interval: Schedule;
        data: DataOf<TName>;
        options?: JobEnqueueOptions;
    };
    rateLimit?: { max: number; per: string };
    process(ctx: ProcessContext<TName>): Promise<TResult>;
    onStarted?(ctx: JobLifecycleContext<TName>): Promise<void>;
    onCompleted?(
        ctx: JobLifecycleContext<TName>,
        result: TResult,
    ): Promise<void>;
    onTerminalFailure?(
        ctx: JobLifecycleContext<TName>,
        err: Error,
    ): Promise<void>;
}

export interface JobManager {
    register<TName extends QueueName>(workload: Workload<TName>): void;
    getQueues(): Queue[];
    start(): Promise<void>;
    stop(): Promise<void>;
    trigger<TName extends QueueName>(
        workloadName: TName,
        data: DataOf<TName>,
        options?: JobEnqueueOptions,
    ): Promise<string>;
    upsertJobScheduler<TName extends QueueName>(
        workloadName: TName,
        schedulerId: string,
        schedule: Schedule,
        data: DataOf<TName>,
        options?: JobEnqueueOptions,
    ): Promise<string>;
    getJobSchedulerIds<TName extends QueueName>(
        workloadName: TName,
    ): Promise<string[]>;
    removeJobScheduler<TName extends QueueName>(
        workloadName: TName,
        schedulerId: string,
    ): Promise<boolean>;
}
