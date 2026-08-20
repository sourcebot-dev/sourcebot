import { Queue } from "bullmq";
import { randomUUID } from "crypto";
import { Redis } from "ioredis";
import { isDeepStrictEqual } from "node:util";
import type {
    DataOf,
    JobEnqueueOptions,
    QueueName,
    QueueSpec,
    ResultOf,
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
    result: ResultOf<TName> | null;
}

type WorkloadQueue<TName extends QueueName> = Queue<
    DataOf<TName>,
    ResultOf<TName>,
    string,
    DataOf<TName>,
    ResultOf<TName>,
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

        const result = (() => {
            if (status !== "COMPLETED" || !spec.resultSchema) {
                return null;
            }

            const parsed = spec.resultSchema.safeParse(job.returnvalue);
            return parsed.success ? parsed.data : null;
        })();

        return {
            id: job.id ?? jobId,
            data: job.data as DataOf<TName>,
            status,
            errorMessage: status === "FAILED" ? job.failedReason || null : null,
            result,
        };
    }

    async getJobs<TName extends QueueName>(
        spec: QueueSpec<TName>,
        jobIds: readonly string[],
    ): Promise<Map<string, WorkloadJob<TName> | null>> {
        const uniqueJobIds = [...new Set(jobIds)];
        const jobs = await Promise.all(
            uniqueJobIds.map((jobId) => this.getJob(spec, jobId)),
        );

        return new Map(
            uniqueJobIds.map((jobId, index) => [jobId, jobs[index] ?? null]),
        );
    }

    async getFailedJobIds<TName extends QueueName>(
        spec: QueueSpec<TName>,
    ): Promise<string[]> {
        const jobs = await this.getQueue(spec).getJobs(
            ["failed"],
            0,
            -1,
            true,
        );

        return jobs.flatMap((job) => job.id ? [job.id] : []);
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
        // QueueSpec is distributive so queue names, data, and result schemas stay
        // correlated when TName is a union. Re-establish the shared generic here
        // before invoking the optional method.
        const { deduplication: getDeduplication }: {
            deduplication?(
                data: DataOf<TName>,
            ): { id: string; keepLastIfActive?: boolean };
        } = spec;
        const deduplication = getDeduplication?.(data);
        const queue = this.getQueue(spec);

        const requestedJobId = randomUUID();
        const job = await queue.add(spec.name, data, {
            jobId: requestedJobId,
            ...(deduplication ? { deduplication } : {}),
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
        const template = {
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
        };

        const existingScheduler = await queue.getJobScheduler(schedulerId);
        // `startDate` and `next` are scheduler state, not configuration. Avoiding an
        // unchanged upsert preserves the next run instead of moving it forward.
        if (
            existingScheduler?.next !== undefined &&
            existingScheduler.name === template.name &&
            existingScheduler.every === intervalMs &&
            isDeepStrictEqual(
                existingScheduler.template?.data,
                template.data,
            ) &&
            isDeepStrictEqual(existingScheduler.template?.opts, template.opts)
        ) {
            return `repeat:${schedulerId}:${existingScheduler.next}`;
        }

        // @note: jobs produced by BullMQ's scheduler bypass the deduplication check that
        // `Queue.add` goes through, so a dedup key would be silently ignored here.
        const job = await queue.upsertJobScheduler(
            schedulerId,
            {
                every: intervalMs,
                startDate: Date.now() + intervalMs,
            },
            {
                ...template,
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
