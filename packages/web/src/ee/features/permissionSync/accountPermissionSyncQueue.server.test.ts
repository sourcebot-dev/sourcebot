import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    enqueue: vi.fn(),
    getConfigSettings: vi.fn(),
    removeJobScheduler: vi.fn(),
    upsertJobScheduler: vi.fn(),
}));

const accountPermissionSyncQueue = {
    name: 'account-permission-sync',
};

vi.mock('server-only', () => ({}));
vi.mock('@/lib/bullmqClient', () => ({
    getBullMQClient: () => ({
        enqueue: mocks.enqueue,
        removeJobScheduler: mocks.removeJobScheduler,
        upsertJobScheduler: mocks.upsertJobScheduler,
    }),
}));
vi.mock('@sourcebot/shared', () => ({
    ACCOUNT_PERMISSION_SYNC_QUEUE: accountPermissionSyncQueue,
    env: { CONFIG_PATH: '/config.json' },
    getAccountPermissionSyncSchedulerId: (accountId: string) =>
        `account-permission-sync-v1-${accountId}`,
    getConfigSettings: mocks.getConfigSettings,
    JOB_PRIORITIES: {
        INTERACTIVE: 1,
        SCHEDULED: 10,
    },
}));

const {
    removeAccountPermissionSyncScheduler,
    scheduleAndTriggerAccountPermissionSync,
} = await import('./accountPermissionSyncQueue.server');

beforeEach(() => {
    vi.clearAllMocks();
    mocks.getConfigSettings.mockResolvedValue({
        userDrivenPermissionSyncIntervalMs: 86_400_000,
    });
    mocks.upsertJobScheduler.mockResolvedValue('scheduled-job');
    mocks.enqueue.mockResolvedValue('job-1');
    mocks.removeJobScheduler.mockResolvedValue(true);
});

describe('scheduleAndTriggerAccountPermissionSync', () => {
    test('upserts the account scheduler before enqueueing an immediate sync', async () => {
        await expect(
            scheduleAndTriggerAccountPermissionSync('account-1'),
        ).resolves.toEqual({ jobId: 'job-1' });

        expect(mocks.getConfigSettings).toHaveBeenCalledWith('/config.json');
        expect(mocks.upsertJobScheduler).toHaveBeenCalledWith(
            accountPermissionSyncQueue,
            'account-permission-sync-v1-account-1',
            86_400_000,
            { accountId: 'account-1' },
            { priority: 10 },
        );
        expect(mocks.enqueue).toHaveBeenCalledWith(
            accountPermissionSyncQueue,
            { accountId: 'account-1' },
            { priority: 1 },
        );
        expect(
            mocks.upsertJobScheduler.mock.invocationCallOrder[0],
        ).toBeLessThan(mocks.enqueue.mock.invocationCallOrder[0]);
    });
});

describe('removeAccountPermissionSyncScheduler', () => {
    test('removes the scheduler using the account scheduler ID', async () => {
        await expect(
            removeAccountPermissionSyncScheduler('account-1'),
        ).resolves.toBe(true);

        expect(mocks.removeJobScheduler).toHaveBeenCalledWith(
            accountPermissionSyncQueue,
            'account-permission-sync-v1-account-1',
        );
    });
});
