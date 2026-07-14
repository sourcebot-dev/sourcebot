import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { DataOf, QueueName, QueueSpec } from "./types.js";

export class JobProducer {
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
    ): Promise<void> {
        const dedupKey = spec.dedupKey?.(data);
        await this.queue(spec.name).add(spec.name, data, {
            ...(dedupKey ? { deduplication: { id: dedupKey } } : {}),
            attempts: spec.jobOptions.attempts,
            backoff: { type: spec.jobOptions.backoff.type, delay: spec.jobOptions.backoff.delayMs },
            removeOnComplete: { count: spec.jobOptions.keep.completed },
            removeOnFail: { count: spec.jobOptions.keep.failed },
        });
    }

    async close(): Promise<void> {
        await Promise.all([...this.queues.values()].map((queue) => queue.close()));
    }
}
