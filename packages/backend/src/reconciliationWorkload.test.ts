import type { PrismaClient } from '@sourcebot/db';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@sourcebot/shared', () => ({
    RECONCILIATION_QUEUE: {
        name: 'reconciliation',
        jobOptions: {
            attempts: 2,
            backoff: { type: 'exponential', delayMs: 5000 },
            keep: { completed: 50, failed: 50 },
            keepLogs: 500,
        },
    },
    createLogger: vi.fn(() => ({
        debug: vi.fn(),
    })),
}));

import { createReconciliationWorkload } from './reconciliationWorkload.js';

describe('reconciliationWorkload', () => {
    const findMany = vi.fn();
    const db = {
        connection: {
            findMany,
        },
    } as unknown as PrismaClient;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-27T12:00:00.000Z'));
        findMany.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('runs every 15 minutes on the reconciliation queue', () => {
        const workload = createReconciliationWorkload({
            db,
            settings: {
                resyncConnectionIntervalMs: 24 * 60 * 60 * 1000,
            },
        });

        expect(workload.queueSpec.name).toBe('reconciliation');
        expect(workload.schedule).toEqual({ every: '15m' });
        expect(workload.concurrency).toBe(1);
    });

    test('triggers connection syncs for connections that are due', async () => {
        findMany.mockResolvedValue([
            { id: 42, orgId: 1 },
            { id: 84, orgId: 2 },
        ]);
        const trigger = vi.fn().mockResolvedValue('job-id');
        const workload = createReconciliationWorkload({
            db,
            settings: {
                resyncConnectionIntervalMs: 24 * 60 * 60 * 1000,
            },
        });

        await workload.process({
            data: {},
            jobId: 'reconciliation-job',
            attemptsMade: 0,
            maxAttempts: 2,
            signal: new AbortController().signal,
            logger: {
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
                flush: vi.fn(),
            },
            updateProgress: vi.fn(),
            trigger,
        });

        expect(findMany).toHaveBeenCalledWith({
            where: {
                OR: [
                    { syncedAt: null },
                    { syncedAt: { lt: new Date('2026-07-26T12:00:00.000Z') } },
                ],
            },
            select: {
                id: true,
                orgId: true,
            },
        });
        expect(trigger).toHaveBeenCalledTimes(2);
        expect(trigger).toHaveBeenCalledWith('connection', {
            connectionId: 42,
            orgId: 1,
        });
        expect(trigger).toHaveBeenCalledWith('connection', {
            connectionId: 84,
            orgId: 2,
        });
    });
});
