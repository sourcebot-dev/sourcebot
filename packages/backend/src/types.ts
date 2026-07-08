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

export interface ProcessContext<TData> {
  data: TData;
  jobId: string;
  attemptsMade: number;
  maxAttempts: number;
  signal: AbortSignal;
  log(message: string): Promise<void>;
  updateProgress(progress: number | object): Promise<void>;
}

export interface QueueSpec<TData> {
  name: string;
  dedupKey(data: TData): string;
  jobOptions: {
    attempts: number;
    backoff: { type: 'fixed' | 'exponential'; delayMs: number };
    keep: { completed: number; failed: number };
  };
}

export interface Workload<TData, TResult = unknown> {
  spec: QueueSpec<TData>;
  concurrency: number;
  rateLimit?: { max: number; per: string };
  process(ctx: ProcessContext<TData>): Promise<TResult>;
  onTerminalFailure?(data: TData, err: Error): Promise<void>;
}


export type Schedule = { every: string } | { pattern: string };

export interface JobManager {
  register<T>(w: Workload<T>): void;
  registerCron(cron: CronWorkload): void;

  start(): Promise<void>;
  stop(): Promise<void>;

  trigger<T>(workload: string, data: T): Promise<void>;

  status(workload: string): Promise<QueueCounts>;
  jobDetail(workload: string, jobId: string): Promise<JobDetail | null>;
}

export interface CronWorkload {
  name: string;
  schedule: Schedule;
  handler(ctx: CronContext): Promise<void>;
}

export interface CronContext {
  trigger<T>(workload: string, data: T): Promise<void>;
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
