import { AsyncLocalStorage } from "node:async_hooks";
import type { JobLogSink } from "./jobLogger.js";
import type { QueueName } from "./queue.js";

export interface JobLogContext {
    jobId: string;
    queueName: QueueName;
    attempt: number;
    // This is persistence-only; createLogger remains responsible for application output.
    sink: JobLogSink;
}

const jobLogContextStorage = new AsyncLocalStorage<JobLogContext>();

export const runWithJobLogContext = <T>(
    context: JobLogContext,
    callback: () => T,
): T => jobLogContextStorage.run(context, callback);

export const runWithoutJobLogContext = <T>(callback: () => T): T =>
    jobLogContextStorage.exit(callback);

export const getJobLogContext = (): JobLogContext | undefined =>
    jobLogContextStorage.getStore();
