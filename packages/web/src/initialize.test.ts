import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    captureException: vi.fn(),
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    },
    startChangelogPollingJob: vi.fn(),
    startServicePingCronJob: vi.fn(),
    syncWithLighthouse: vi.fn(),
    warmModelCapabilitiesCatalog: vi.fn(),
}));

vi.mock('@/prisma', () => ({
    __unsafePrisma: {},
}));

vi.mock('@/features/billing/servicePing', () => ({
    startServicePingCronJob: mocks.startServicePingCronJob,
    syncWithLighthouse: mocks.syncWithLighthouse,
}));

vi.mock('@/features/changelog/pollChangelog', () => ({
    startChangelogPollingJob: mocks.startChangelogPollingJob,
}));

vi.mock('@sourcebot/shared', () => ({
    createLogger: () => mocks.logger,
    env: {},
}));

vi.mock('./lib/constants', () => ({
    SINGLE_TENANT_ORG_ID: 1,
}));

vi.mock('@/features/chat/utils.server', () => ({
    warmModelCapabilitiesCatalog: mocks.warmModelCapabilitiesCatalog,
}));

vi.mock('@sentry/nextjs', () => ({
    captureException: mocks.captureException,
}));

import { initialize } from './initialize';

describe('initialize', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.syncWithLighthouse.mockResolvedValue(undefined);
    });

    test('refreshes the license before starting background jobs', async () => {
        await initialize();

        expect(mocks.syncWithLighthouse).toHaveBeenCalledWith(1);
        expect(mocks.syncWithLighthouse.mock.invocationCallOrder[0])
            .toBeLessThan(mocks.startServicePingCronJob.mock.invocationCallOrder[0]!);
        expect(mocks.startServicePingCronJob).toHaveBeenCalledOnce();
        expect(mocks.startChangelogPollingJob).toHaveBeenCalledOnce();
        expect(mocks.warmModelCapabilitiesCatalog).toHaveBeenCalledOnce();
    });

    test('logs and reports a failed license refresh without blocking startup', async () => {
        const error = new Error('Lighthouse unavailable');
        mocks.syncWithLighthouse.mockRejectedValue(error);

        await expect(initialize()).resolves.toBeUndefined();

        expect(mocks.logger.error).toHaveBeenCalledWith(
            'Startup Lighthouse sync failed: Lighthouse unavailable',
        );
        expect(mocks.captureException).toHaveBeenCalledWith(error);
        expect(mocks.startServicePingCronJob).toHaveBeenCalledOnce();
        expect(mocks.startChangelogPollingJob).toHaveBeenCalledOnce();
        expect(mocks.warmModelCapabilitiesCatalog).toHaveBeenCalledOnce();
    });
});
