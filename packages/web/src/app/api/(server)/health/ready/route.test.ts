import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    unsafePrisma: {
        $queryRaw: vi.fn(),
    },
    redisPing: vi.fn(),
    zoektList: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/prisma', () => ({
    __unsafePrisma: mocks.unsafePrisma,
}));

vi.mock('@/lib/redis', () => ({
    getRedisClient: () => ({
        ping: mocks.redisPing,
    }),
}));

vi.mock('@/lib/posthog', () => ({
    captureEvent: vi.fn(),
}));

vi.mock('@/lib/zoektClient', () => ({
    loadZoektClient: () => ({
        List: mocks.zoektList,
    }),
}));

vi.mock('@sourcebot/shared', () => ({
    createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

const { GET } = await import('./route');

describe('GET /api/health/ready', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.unsafePrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
        mocks.redisPing.mockResolvedValue('PONG');
        mocks.zoektList.mockImplementation(
            (_request: unknown, callback: (err: Error | null) => void) => {
                callback(null);
            },
        );
    });

    test('returns 200 with status:ok when all three dependencies are reachable', async () => {
        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.status).toBe('ok');
        expect(body.checks.postgres.status).toBe('ok');
        expect(body.checks.redis.status).toBe('ok');
        expect(body.checks.zoekt.status).toBe('ok');
        expect(typeof body.checks.postgres.latencyMs).toBe('number');
        expect(typeof body.checks.redis.latencyMs).toBe('number');
        expect(typeof body.checks.zoekt.latencyMs).toBe('number');
    });

    test('returns 503 with status:degraded and a postgres error when Postgres is unreachable', async () => {
        mocks.unsafePrisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body.status).toBe('degraded');
        expect(body.checks.postgres.status).toBe('error');
        expect(body.checks.postgres.error).toBe('connection refused');
        expect(body.checks.redis.status).toBe('ok');
        expect(body.checks.zoekt.status).toBe('ok');
    });

    test('returns 503 with status:degraded and a redis error when Redis ping fails', async () => {
        mocks.redisPing.mockRejectedValue(new Error('redis down'));

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body.status).toBe('degraded');
        expect(body.checks.postgres.status).toBe('ok');
        expect(body.checks.redis.status).toBe('error');
        expect(body.checks.redis.error).toBe('redis down');
        expect(body.checks.zoekt.status).toBe('ok');
    });

    test('returns 503 with status:degraded when the Zoekt gRPC call errors', async () => {
        mocks.zoektList.mockImplementation(
            (_request: unknown, callback: (err: Error | null) => void) => {
                callback(new Error('UNAVAILABLE: zoekt not reachable'));
            },
        );

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body.status).toBe('degraded');
        expect(body.checks.zoekt.status).toBe('error');
        expect(body.checks.zoekt.error).toContain('UNAVAILABLE');
        expect(body.checks.postgres.status).toBe('ok');
        expect(body.checks.redis.status).toBe('ok');
    });

    test('returns 503 with status:degraded when Redis returns a non-PONG response', async () => {
        mocks.redisPing.mockResolvedValue('NOT-PONG');

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body.status).toBe('degraded');
        expect(body.checks.redis.status).toBe('error');
        expect(body.checks.redis.error).toContain('unexpected ping response');
    });

    test('runs all three checks in parallel (Promise.all)', async () => {
        const delay = 50;
        mocks.unsafePrisma.$queryRaw.mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve([{}]), delay)),
        );
        mocks.redisPing.mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve('PONG'), delay)),
        );
        mocks.zoektList.mockImplementation(
            (_request: unknown, callback: (err: Error | null) => void) => {
                setTimeout(() => callback(null), delay);
            },
        );

        const start = Date.now();
        const response = await GET();
        const elapsed = Date.now() - start;
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.status).toBe('ok');
        // Generous upper bound to avoid flakes; serial would be ~3x delay.
        expect(elapsed).toBeLessThan(delay * 2.5);
    });

    test('does not surface check rejections as unhandled promise rejections', async () => {
        // The check rejects synchronously (well within the 2s timeout). The
        // no-op `.catch` attached in `withTimeout` must absorb that
        // rejection so the Node process does not log an
        // unhandled-promise-rejection warning while the readiness request
        // has already moved on.
        const checkRejection = new Error('check rejected');
        const unhandled: unknown[] = [];
        const onUnhandled = (err: unknown) => { unhandled.push(err); };
        process.on('unhandledRejection', onUnhandled);

        try {
            mocks.unsafePrisma.$queryRaw.mockRejectedValue(checkRejection);
            mocks.redisPing.mockResolvedValue('PONG');
            mocks.zoektList.mockImplementation(
                (_request: unknown, callback: (err: Error | null) => void) => {
                    callback(null);
                },
            );

            const response = await GET();
            const body = await response.json();

            expect(response.status).toBe(503);
            expect(body.checks.postgres.status).toBe('error');
            // Give the rejection microtask a chance to fire and propagate.
            await new Promise((resolve) => setTimeout(resolve, 50));
            expect(unhandled).not.toContain(checkRejection);
        } finally {
            process.off('unhandledRejection', onUnhandled);
        }
    });

    test('issues the Zoekt List RPC with empty options (max_wall_time is a SearchOptions field, not ListOptions)', async () => {
        // Regression guard: the earlier draft of the Zoekt probe passed
        // `{ opts: { max_wall_time: ... } }` to the `List` RPC. That field
        // belongs to `SearchOptions` and is silently ignored by `List`
        // (whose `ListOptions` only carries `field`). The 2s client-side
        // timeout is the only thing that actually bounds the call. The
        // probe must therefore issue the smallest valid request, which is
        // an empty options object.
        const response = await GET();
        expect(response.status).toBe(200);
        expect(mocks.zoektList).toHaveBeenCalledTimes(1);
        expect(mocks.zoektList).toHaveBeenCalledWith({}, expect.any(Function));
    });
});
