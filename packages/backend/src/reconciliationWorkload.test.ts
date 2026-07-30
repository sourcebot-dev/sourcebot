import type { PrismaClient } from '@sourcebot/db';
import type { JobLogger } from '@sourcebot/shared';
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
}));

import { createReconciliationWorkload } from './reconciliationWorkload.js';

const settings = {
    resyncConnectionIntervalMs: 24 * 60 * 60 * 1000,
    reindexIntervalMs: 60 * 60 * 1000,
    repoGarbageCollectionGracePeriodMs: 10 * 1000,
};

const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: vi.fn(),
} satisfies JobLogger;

describe('reconciliationWorkload', () => {
    const connectionFindMany = vi.fn();
    const repoFindMany = vi.fn();
    const db = {
        connection: {
            findMany: connectionFindMany,
        },
        repo: {
            findMany: repoFindMany,
        },
    } as unknown as PrismaClient;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-27T12:00:00.000Z'));
        connectionFindMany.mockReset().mockResolvedValue([]);
        repoFindMany.mockReset().mockResolvedValue([]);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('runs every 15 minutes on the reconciliation queue', () => {
        const workload = createReconciliationWorkload({
            db,
            settings,
        });

        expect(workload.queueSpec.name).toBe('reconciliation');
        expect(workload.schedule).toEqual({ every: '15m' });
        expect(workload.concurrency).toBe(1);
    });

    test('triggers connection syncs for connections that are due', async () => {
        connectionFindMany.mockResolvedValue([
            { id: 42, orgId: 1 },
            { id: 84, orgId: 2 },
        ]);
        const trigger = vi.fn().mockResolvedValue('job-id');
        const workload = createReconciliationWorkload({
            db,
            settings,
        });

        await workload.process({
            data: {},
            jobId: 'reconciliation-job',
            attemptsMade: 0,
            maxAttempts: 2,
            prisma: db,
            signal: new AbortController().signal,
            logger,
            updateProgress: vi.fn(),
            trigger,
        });

        expect(connectionFindMany).toHaveBeenCalledWith({
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

    test('submits all due repos for indexing', async () => {
        repoFindMany
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                { id: 1 },
                { id: 2 },
                { id: 3 },
                { id: 4 },
            ]);
        const trigger = vi.fn().mockResolvedValue('job-id');
        const workload = createReconciliationWorkload({
            db,
            settings,
        });

        await workload.process({
            data: {},
            jobId: 'reconciliation-job',
            attemptsMade: 0,
            maxAttempts: 2,
            prisma: db,
            signal: new AbortController().signal,
            logger,
            updateProgress: vi.fn(),
            trigger,
        });

        expect(trigger).toHaveBeenCalledTimes(4);
        for (const repoId of [1, 2, 3, 4]) {
            expect(trigger).toHaveBeenCalledWith('repo-index', {
                repoId,
                type: 'INDEX',
            });
        }
    });

    test('schedules orphaned repos for cleanup', async () => {
        repoFindMany
            .mockResolvedValueOnce([{ id: 42 }])
            .mockResolvedValueOnce([]);
        const trigger = vi.fn().mockResolvedValue('job-id');
        const workload = createReconciliationWorkload({
            db,
            settings,
        });

        await workload.process({
            data: {},
            jobId: 'reconciliation-job',
            attemptsMade: 0,
            maxAttempts: 2,
            prisma: db,
            signal: new AbortController().signal,
            logger,
            updateProgress: vi.fn(),
            trigger,
        });

        expect(trigger).toHaveBeenCalledWith('repo-index', {
            repoId: 42,
            type: 'CLEANUP',
        });
    });
});
