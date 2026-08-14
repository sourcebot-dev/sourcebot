import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    init: vi.fn(),
    nodeProfilingIntegration: vi.fn(() => ({ name: 'ProfilingIntegration' })),
}));

vi.mock('@sentry/nextjs', () => ({
    init: mocks.init,
}));

vi.mock('@sentry/profiling-node', () => ({
    nodeProfilingIntegration: mocks.nodeProfilingIntegration,
}));

vi.mock('@sourcebot/shared', () => ({
    createLogger: () => ({
        debug: vi.fn(),
    }),
}));

const importConfig = async (environment: string) => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_WEBAPP_DSN', 'https://public@example.com/1');
    vi.stubEnv('NEXT_PUBLIC_SENTRY_ENVIRONMENT', environment);
    await import('./sentry.server.config');
};

describe('Sentry server configuration', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    test('keeps production error reporting without request tracing or profiling', async () => {
        await importConfig('production');

        expect(mocks.init).toHaveBeenCalledOnce();
        const options = mocks.init.mock.calls[0][0];
        expect(options).toMatchObject({
            dsn: 'https://public@example.com/1',
            environment: 'production',
        });
        expect(options).not.toHaveProperty('tracesSampleRate');
        expect(options).not.toHaveProperty('profileSessionSampleRate');
        expect(options).not.toHaveProperty('profileLifecycle');
        expect(options).not.toHaveProperty('integrations');
        expect(mocks.nodeProfilingIntegration).not.toHaveBeenCalled();
    });

    test('keeps tracing and profiling available in development', async () => {
        await importConfig('development');

        expect(mocks.init).toHaveBeenCalledWith({
            dsn: 'https://public@example.com/1',
            environment: 'development',
            integrations: [{ name: 'ProfilingIntegration' }],
            tracesSampleRate: 1.0,
            profileSessionSampleRate: 1.0,
            profileLifecycle: 'trace',
        });
        expect(mocks.nodeProfilingIntegration).toHaveBeenCalledOnce();
    });
});
