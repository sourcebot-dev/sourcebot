import * as Sentry from "@sentry/node";
import { Queue } from "bullmq";
import { randomUUID } from "crypto";
import { Redis } from "ioredis";
import { createLogger } from "./logger.js";
import { DataOf, QueueName, QueueSpec } from "./queue.js";
import { PrismaClient } from "@sourcebot/db";
import { readBullMQJobLogs } from "./jobLogger.js";
import type { GetJobLogsOptions, JobLogs } from "./jobLogger.js";

const logger = createLogger('job-producer');

export type WorkloadJobStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

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

    constructor(
        private readonly connection: Redis,
        private readonly prisma: PrismaClient,
    ) {}

    getQueue<TName extends QueueName>(spec: QueueSpec<TName>): WorkloadQueue<TName> {
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
        data: DataOf<TName>
    ): Promise<string> {
        const dedupKey = spec.dedupKey?.(data);
        const queue = this.getQueue(spec);

        const requestedJobId = randomUUID();
        const job = await queue.add(spec.name, data, {
            jobId: requestedJobId,
            ...(dedupKey ? { deduplication: { id: dedupKey } } : {}),
            attempts: spec.jobOptions.attempts,
            backoff: { type: spec.jobOptions.backoff.type, delay: spec.jobOptions.backoff.delayMs },
            removeOnComplete: { count: spec.jobOptions.keep.completed },
            removeOnFail: { count: spec.jobOptions.keep.failed },
            keepLogs: spec.jobOptions.keepLogs,
        });

        if (!job.id) {
            throw new Error(`BullMQ did not return an id for workload "${spec.name}"`);
        }

        const isEnqueued = job.id === requestedJobId;
        if (isEnqueued && spec.onEnqueued) {
            try {
                await spec.onEnqueued({
                    data,
                    jobId: job.id,
                    attemptsMade: 0,
                    maxAttempts: spec.jobOptions.attempts,
                    prisma: this.prisma,
                });
            } catch (error) {
                Sentry.captureException(error);
                logger.error(`onEnqueued for workload "${spec.name}" threw:`, error);
            }
        }

        return job.id;
    }

    async close(): Promise<void> {
        await Promise.all([...this.queues.values()].map((queue) => queue.close()));
    }
}
