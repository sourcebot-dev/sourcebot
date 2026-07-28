import * as Sentry from "@sentry/node";
import { Queue } from "bullmq";
import { randomUUID } from "crypto";
import { Redis } from "ioredis";
import { createLogger } from "./logger.js";
import { DataOf, QueueName, QueueSpec } from "./queue.js";

const logger = createLogger('job-producer');

export class BullMQJobProducer {
    private readonly queues = new Map<string, Queue>();

    constructor(private readonly connection: Redis) {}

    queue(name: string): Queue {
        let queue = this.queues.get(name);
        if (!queue) {
            queue = new Queue(name, { connection: this.connection });
            this.queues.set(name, queue);
        }
        return queue;
    }

    async enqueue<TName extends QueueName>(
        spec: QueueSpec<TName>,
        data: DataOf<TName>
    ): Promise<string> {
        const dedupKey = spec.dedupKey?.(data);
        const queue = this.queue(spec.name);

        const requestedJobId = randomUUID();
        const job = await queue.add(spec.name, data, {
            jobId: requestedJobId,
            ...(dedupKey ? { deduplication: { id: dedupKey } } : {}),
            attempts: spec.jobOptions.attempts,
            backoff: { type: spec.jobOptions.backoff.type, delay: spec.jobOptions.backoff.delayMs },
            removeOnComplete: { count: spec.jobOptions.keep.completed },
            removeOnFail: { count: spec.jobOptions.keep.failed },
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
