import { Queue } from "bullmq";
import { randomUUID } from "crypto";
import { Redis } from "ioredis";
import type {
    DataOf,
    JobEnqueueOptions,
    QueueName,
    QueueSpec,
} from "./queue.js";
import { scheduleToMs } from "./schedule.js";
import type { Schedule } from "./schedule.js";
import { readBullMQJobLogs } from "./jobLogger.js";
import type { GetJobLogsOptions, JobLogs } from "./jobLogger.js";

export type WorkloadJobStatus =
    | "PENDING"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "FAILED";

export interface WorkloadJob<TName extends QueueName> {
    id: string;
    data: DataOf<TName>;
    status: WorkloadJobStatus;
    errorMessage: string | null;
}

type WorkloadQueue<TName extends QueueName> = Queue<
    DataOf<TName>,
    unknown,
    string,
    DataOf<TName>,
    unknown,
    string
>;

const normalizeJobState = (state: string): WorkloadJobStatus | null => {
    switch (state) {
        case "waiting":
        case "waiting-children":
        case "delayed":
        case "prioritized":
        case "paused":
            return "PENDING";
        case "active":
            return "IN_PROGRESS";
        case "completed":
            return "COMPLETED";
        case "failed":
            return "FAILED";
        default:
            return null;
    }
};

export class BullMQClient {
    private readonly queues = new Map<string, Queue>();

    constructor(private readonly connection: Redis) {}

    getQueue<TName extends QueueName>(
        spec: QueueSpec<TName>,
    ): WorkloadQueue<TName> {
        const queueName = spec.name;
        let queue = this.queues.get(queueName);
        if (!queue) {
            queue = new Queue(queueName, { connection: this.connection });
            this.queues.set(queueName, queue);
        }
        return queue as WorkloadQueue<TName>;
    }

    async getJob<TName extends QueueName>(
        spec: QueueSpec<TName>,
        jobId: string,
    ): Promise<WorkloadJob<TName> | null> {
        const job = await this.getQueue(spec).getJob(jobId);
        if (!job) {
            return null;
        }

        const status = normalizeJobState(await job.getState());
        if (!status) {
            return null;
        }

        return {
            id: job.id ?? jobId,
            data: job.data as DataOf<TName>,
            status,
            errorMessage: status === "FAILED" ? job.failedReason || null : null,
        };
    }

    async getJobLogs<TName extends QueueName>(
        spec: QueueSpec<TName>,
        jobId: string,
        options: GetJobLogsOptions = {},
    ): Promise<JobLogs> {
        return readBullMQJobLogs(this.getQueue(spec), jobId, options);
    }

    async enqueue<TName extends QueueName>(
        spec: QueueSpec<TName>,
        data: DataOf<TName>,
        options: JobEnqueueOptions = {},
    ): Promise<string> {
        const dedupKey = spec.dedupKey?.(data);
        const queue = this.getQueue(spec);

        const requestedJobId = randomUUID();
        const job = await queue.add(spec.name, data, {
            jobId: requestedJobId,
            ...(dedupKey ? { deduplication: { id: dedupKey } } : {}),
            ...(options.priority !== undefined
                ? { priority: options.priority }
                : {}),
            attempts: spec.jobOptions.attempts,
            backoff: {
                type: spec.jobOptions.backoff.type,
                delay: spec.jobOptions.backoff.delayMs,
                ...(spec.jobOptions.backoff.jitter !== undefined
                    ? { jitter: spec.jobOptions.backoff.jitter }
                    : {}),
            },
            removeOnComplete: spec.jobOptions.keepJobs.completed,
            removeOnFail: spec.jobOptions.keepJobs.failed,
            keepLogs: spec.jobOptions.keepLogs,
        });

        if (!job.id) {
            throw new Error(
                `BullMQ did not return an id for workload "${spec.name}"`,
            );
        }

        return job.id;
    }

    async upsertJobScheduler<TName extends QueueName>(
        spec: QueueSpec<TName>,
        schedulerId: string,
        schedule: Schedule,
        data: DataOf<TName>,
        options: JobEnqueueOptions = {},
    ): Promise<string> {
        const queue = this.getQueue(spec);
        const intervalMs = scheduleToMs(schedule);

        // @note: jobs produced by BullMQ's scheduler bypass the deduplication check that
        // `Queue.add` goes through, so a dedup key would be silently ignored here.
        const job = await queue.upsertJobScheduler(
            schedulerId,
            {
                every: intervalMs,
                startDate: Date.now() + intervalMs,
            },
            {
                name: spec.name,
                data,
                opts: {
                    ...(options.priority !== undefined
                        ? { priority: options.priority }
                        : {}),
                    attempts: spec.jobOptions.attempts,
                    backoff: {
                        type: spec.jobOptions.backoff.type,
                        delay: spec.jobOptions.backoff.delayMs,
                        ...(spec.jobOptions.backoff.jitter !== undefined
                            ? { jitter: spec.jobOptions.backoff.jitter }
                            : {}),
                    },
                    removeOnComplete: spec.jobOptions.keepJobs.completed,
                    removeOnFail: spec.jobOptions.keepJobs.failed,
                    keepLogs: spec.jobOptions.keepLogs,
                },
            },
        );

        if (!job.id) {
            throw new Error(
                `BullMQ did not return an id for workload "${spec.name}"`,
            );
        }

        return job.id;
    }

    async getJobSchedulerIds<TName extends QueueName>(
        spec: QueueSpec<TName>,
    ): Promise<string[]> {
        const schedulers = await this.getQueue(spec).getJobSchedulers();
        return schedulers.map(({ key }) => key);
    }

    removeJobScheduler<TName extends QueueName>(
        spec: QueueSpec<TName>,
        schedulerId: string,
    ): Promise<boolean> {
        return this.getQueue(spec).removeJobScheduler(schedulerId);
    }

    async close(): Promise<void> {
        await Promise.all(
            [...this.queues.values()].map((queue) => queue.close()),
        );
    }
}
