import type { PrismaClient } from '@sourcebot/db';
import type { JobLogger } from '@sourcebot/shared';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    env: {
        PERMISSION_SYNC_ENABLED: 'true',
    },
    hasEntitlement: vi.fn(),
}));

vi.mock('@sourcebot/shared', () => ({
    env: mocks.env,
    PERMISSION_SYNC_SUPPORTED_IDENTITY_PROVIDERS: [
        'github',
        'gitlab',
        'bitbucket-cloud',
        'bitbucket-server',
    ],
    PERMISSION_SYNC_SUPPORTED_CODE_HOST_TYPES: [
        'github',
        'gitlab',
        'bitbucketCloud',
        'bitbucketServer',
    ],
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

vi.mock('./entitlements.js', () => ({
    hasEntitlement: mocks.hasEntitlement,
}));

import { createReconciliationWorkload } from './reconciliationWorkload.js';

const settings = {
    resyncConnectionIntervalMs: 24 * 60 * 60 * 1000,
    reindexIntervalMs: 60 * 60 * 1000,
    repoGarbageCollectionGracePeriodMs: 10 * 1000,
    userDrivenPermissionSyncIntervalMs: 24 * 60 * 60 * 1000,
    repoDrivenPermissionSyncIntervalMs: 24 * 60 * 60 * 1000,
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
    const accountFindMany = vi.fn();
    const db = {
        connection: {
            findMany: connectionFindMany,
        },
        repo: {
            findMany: repoFindMany,
        },
        account: {
            findMany: accountFindMany,
        },
    } as unknown as PrismaClient;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-27T12:00:00.000Z'));
        connectionFindMany.mockReset().mockResolvedValue([]);
        repoFindMany.mockReset().mockResolvedValue([]);
        accountFindMany.mockReset().mockResolvedValue([]);
        mocks.env.PERMISSION_SYNC_ENABLED = 'true';
        mocks.hasEntitlement.mockReset().mockResolvedValue(false);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('runs every 10 seconds on the reconciliation queue', () => {
        const workload = createReconciliationWorkload({
            db,
            settings,
        });

        expect(workload.queueSpec.name).toBe('reconciliation');
        expect(workload.schedule).toEqual({ every: '10s' });
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
        expect(trigger).toHaveBeenCalledWith('connection-sync', {
            connectionId: 42,
            orgId: 1,
        });
        expect(trigger).toHaveBeenCalledWith('connection-sync', {
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

    test('submits due accounts for permission syncing when entitled', async () => {
        mocks.hasEntitlement.mockResolvedValue(true);
        accountFindMany.mockResolvedValue([
            { id: 'account_1' },
            { id: 'account_2' },
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

        expect(accountFindMany).toHaveBeenCalledWith({
            where: {
                AND: [
                    {
                        providerType: {
                            in: ['github', 'gitlab', 'bitbucket-cloud', 'bitbucket-server'],
                        },
                    },
                    {
                        OR: [
                            { permissionSyncedAt: null },
                            { permissionSyncedAt: { lt: new Date('2026-07-26T12:00:00.000Z') } },
                        ],
                    },
                ],
            },
            select: {
                id: true,
            },
        });
        expect(trigger).toHaveBeenCalledWith('account-permission-sync', {
            accountId: 'account_1',
        });
        expect(trigger).toHaveBeenCalledWith('account-permission-sync', {
            accountId: 'account_2',
        });
    });

    test('does not query accounts without the permission syncing entitlement', async () => {
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
            trigger: vi.fn(),
        });

        expect(accountFindMany).not.toHaveBeenCalled();
        expect(repoFindMany).toHaveBeenCalledTimes(2);
    });

    test('does not query accounts when permission syncing is disabled', async () => {
        mocks.env.PERMISSION_SYNC_ENABLED = 'false';
        mocks.hasEntitlement.mockResolvedValue(true);
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
            trigger: vi.fn(),
        });

        expect(mocks.hasEntitlement).not.toHaveBeenCalled();
        expect(accountFindMany).not.toHaveBeenCalled();
        expect(repoFindMany).toHaveBeenCalledTimes(2);
    });

    test('submits due private repos for permission syncing when entitled', async () => {
        mocks.hasEntitlement.mockResolvedValue(true);
        repoFindMany
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                { id: 42 },
                { id: 84 },
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

        expect(repoFindMany).toHaveBeenNthCalledWith(3, {
            where: {
                AND: [
                    {
                        isPublic: false,
                    },
                    {
                        external_codeHostType: {
                            in: ['github', 'gitlab', 'bitbucketCloud', 'bitbucketServer'],
                        },
                    },
                    {
                        connections: {
                            some: {
                                connection: {
                                    enforcePermissions: true,
                                },
                            },
                        },
                    },
                    {
                        OR: [
                            { permissionSyncedAt: null },
                            { permissionSyncedAt: { lt: new Date('2026-07-26T12:00:00.000Z') } },
                        ],
                    },
                ],
            },
            select: {
                id: true,
            },
        });
        expect(trigger).toHaveBeenCalledWith('repo-permission-sync', {
            repoId: 42,
        });
        expect(trigger).toHaveBeenCalledWith('repo-permission-sync', {
            repoId: 84,
        });
    });
});
