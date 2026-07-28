import type { Redis } from 'ioredis';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { QueueSpec } from './queue.js';

const queueMocks = vi.hoisted(() => ({
    add: vi.fn(),
    close: vi.fn(),
}));

vi.mock('@sentry/node', () => ({
    captureException: vi.fn(),
}));

vi.mock('./logger.js', () => ({
    createLogger: vi.fn(() => ({
        error: vi.fn(),
    })),
}));

vi.mock('bullmq', () => ({
    Queue: class {
        constructor() {
            return queueMocks;
        }
    },
}));

import { BullMQJobProducer } from './jobProducer.js';

const connectionSpec: QueueSpec<'connection'> = {
    name: 'connection',
    dedupKey: ({ connectionId }) => `connection:${connectionId}`,
    jobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delayMs: 5000 },
        keep: { completed: 50, failed: 50 },
    },
};

const data = { connectionId: 42, orgId: 1 };

describe('BullMQJobProducer', () => {
    const redis = {} as Redis;

    beforeEach(() => {
        vi.clearAllMocks();
        queueMocks.add.mockImplementation(async (_name, _data, options) => ({ id: options.jobId }));
    });

    test('returns the job id when BullMQ accepts the proposed id', async () => {
        const producer = new BullMQJobProducer(redis);

        const result = await producer.enqueue(connectionSpec, data);

        expect(result).toEqual(expect.any(String));
        expect(queueMocks.add).toHaveBeenCalledWith(
            'connection',
            data,
            expect.objectContaining({
                jobId: result,
                deduplication: { id: 'connection:42' },
            }),
        );
    });

    test('calls onEnqueued when a new job is created', async () => {
        const onEnqueued = vi.fn();
        const producer = new BullMQJobProducer(redis);

        const result = await producer.enqueue({ ...connectionSpec, onEnqueued }, data);

        expect(onEnqueued).toHaveBeenCalledWith({
            data,
            jobId: result,
            attemptsMade: 0,
            maxAttempts: 2,
        });
    });

    test('returns the existing job id without calling onEnqueued when BullMQ deduplicates the enqueue', async () => {
        const onEnqueued = vi.fn();
        queueMocks.add.mockResolvedValue({ id: 'existing-job' });
        const producer = new BullMQJobProducer(redis);

        const result = await producer.enqueue({ ...connectionSpec, onEnqueued }, data);

        expect(result).toBe('existing-job');
        expect(onEnqueued).not.toHaveBeenCalled();
    });
});
