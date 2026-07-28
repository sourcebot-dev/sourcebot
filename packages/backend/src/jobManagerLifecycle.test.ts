import { Redis } from 'ioredis';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ProcessContext, Workload } from './types.js';

const mocks = vi.hoisted(() => ({
    enqueue: vi.fn(),
    producerClose: vi.fn(),
    workerClose: vi.fn(),
    jobLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        flush: vi.fn(),
    },
    workers: [] as Array<{
        processor: (job: unknown) => Promise<unknown>;
        handlers: Map<string, (...args: unknown[]) => void>;
    }>,
}));

vi.mock('@sentry/node', () => ({
    captureException: vi.fn(),
}));

vi.mock('@sourcebot/shared', () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    })),
    createBullMQJobLogger: vi.fn(() => mocks.jobLogger),
    BullMQClient: class {
        enqueue = mocks.enqueue;
        close = mocks.producerClose;
        queue = vi.fn(() => ({
            getJobCounts: vi.fn(),
            upsertJobScheduler: vi.fn(),
        }));
    },
}));

vi.mock('./constants.js', () => ({
    WORKER_STOP_GRACEFUL_TIMEOUT_MS: 5000,
}));

vi.mock('bullmq', () => ({
    Worker: class {
        private readonly record: (typeof mocks.workers)[number];

        constructor(_name: string, processor: (job: unknown) => Promise<unknown>) {
            this.record = { processor, handlers: new Map() };
            mocks.workers.push(this.record);
        }

        on(event: string, handler: (...args: unknown[]) => void) {
            this.record.handlers.set(event, handler);
        }

        close = mocks.workerClose;
    },
}));

import { BullMQJobManager } from './jobManager.js';

const createWorkload = (
    overrides: Partial<Workload<'connection', { repoCount: number }>> = {},
): Workload<'connection', { repoCount: number }> => ({
    queueSpec: {
        name: 'connection',
        dedupKey: ({ connectionId }) => `connection:${connectionId}`,
        jobOptions: {
            attempts: 2,
            backoff: { type: 'exponential', delayMs: 5000 },
            keep: { completed: 50, failed: 50 },
            keepLogs: 500,
        },
    },
    concurrency: 2,
    process: vi.fn(async () => ({ repoCount: 3 })),
    ...overrides,
});

const data = { connectionId: 42, orgId: 1 };
const job = {
    id: 'job-1',
    data,
    attemptsMade: 2,
    opts: { attempts: 2 },
    log: vi.fn(),
    updateProgress: vi.fn(),
};

describe('BullMQJobManager lifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.workers.length = 0;
        mocks.enqueue.mockResolvedValue('job-1');
    });

    test('delegates enqueueing to BullMQClient and returns its job id', async () => {
        const manager = new BullMQJobManager({} as Redis);
        const workload = createWorkload();
        manager.register(workload);

        const result = await manager.trigger('connection', data);

        expect(result).toBe('job-1');
        expect(mocks.enqueue).toHaveBeenCalledWith(workload.queueSpec, data);
    });

    test('calls onStarted before processing and onCompleted after completion', async () => {
        const calls: string[] = [];
        const workload = createWorkload({
            onStarted: vi.fn(async () => { calls.push('started'); }),
            process: vi.fn(async () => {
                calls.push('processed');
                return { repoCount: 3 };
            }),
            onCompleted: vi.fn(async () => { calls.push('completed'); }),
        });
        const manager = new BullMQJobManager({} as Redis);
        manager.register(workload);
        await manager.start();

        const result = await mocks.workers[0].processor({ ...job, attemptsMade: 0 });
        expect(calls).toEqual(['started', 'processed']);

        mocks.workers[0].handlers.get('completed')?.(job, result);
        await vi.waitFor(() => expect(calls).toEqual(['started', 'processed', 'completed']));
        expect(workload.onCompleted).toHaveBeenCalledWith(
            expect.objectContaining({ data, jobId: 'job-1', maxAttempts: 2 }),
            { repoCount: 3 },
        );
        expect(mocks.jobLogger.flush).toHaveBeenCalled();
    });

    test('provides the structured job logger to the workload processor', async () => {
        const process = vi.fn(async (context: ProcessContext<'connection'>) => {
            context.logger.info('Processing connection');
            return { repoCount: 3 };
        });
        const manager = new BullMQJobManager({} as Redis);
        manager.register(createWorkload({ process }));
        await manager.start();

        await mocks.workers[0].processor({ ...job, attemptsMade: 0 });

        expect(process).toHaveBeenCalledWith(expect.objectContaining({
            logger: mocks.jobLogger,
        }));
        expect(mocks.jobLogger.info).toHaveBeenCalledWith('Processing connection');
        expect(mocks.jobLogger.flush).toHaveBeenCalled();
    });

    test('reports lifecycle metadata after terminal failure', async () => {
        const onTerminalFailure = vi.fn();
        const workload = createWorkload({ onTerminalFailure });
        const manager = new BullMQJobManager({} as Redis);
        manager.register(workload);
        await manager.start();

        const error = new Error('failed');
        mocks.workers[0].handlers.get('failed')?.(job, error);

        await vi.waitFor(() => {
            expect(onTerminalFailure).toHaveBeenCalledWith(expect.objectContaining({
                data,
                jobId: 'job-1',
                attemptsMade: 2,
                maxAttempts: 2,
            }), error);
        });
    });
});
