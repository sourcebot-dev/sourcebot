import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

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

// Minimal NextRequest stand-in. We only need `nextUrl.searchParams`; the
// runtime calls are not exercised.
const makeRequest = (search: Record<string, string> = {}): NextRequest => {
    const params = new URLSearchParams(search);
    const url = `http://localhost/api/health/ready?${params.toString()}`;
    return new NextRequest(url);
};

// Default Zoekt response: a single indexed repo. Tests that need a
// different shape override the mock implementation locally.
const defaultZoektResponse = { repos: [{}] };

// gRPC callback shape: (err, response) => void. Pulled out so the seven
// `mocks.zoektList.mockImplementation(...)` blocks below stay short.
type ZoektListCallback = (
    err: Error | null,
    response?: { repos?: unknown[]; repos_map?: Record<number, unknown> },
) => void;

describe('GET /api/health/ready', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.unsafePrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
        mocks.redisPing.mockResolvedValue('PONG');
        mocks.zoektList.mockImplementation(
            (_request: unknown, callback: ZoektListCallback) => {
                callback(null, defaultZoektResponse);
            },
        );
    });

    test('returns 200 with status:ok and strict:false when all three dependencies are reachable', async () => {
        const response = await GET(makeRequest());
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.status).toBe('ok');
        expect(body.strict).toBe(false);
        expect(body.checks.postgres.status).toBe('ok');
        expect(body.checks.redis.status).toBe('ok');
        expect(body.checks.zoekt.status).toBe('ok');
        expect(typeof body.checks.postgres.latencyMs).toBe('number');
        expect(typeof body.checks.redis.latencyMs).toBe('number');
        expect(typeof body.checks.zoekt.latencyMs).toBe('number');
    });

    test('returns 503 with status:degraded and a postgres error when Postgres is unreachable', async () => {
        mocks.unsafePrisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

        const response = await GET(makeRequest());
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

        const response = await GET(makeRequest());
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

        const response = await GET(makeRequest());
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

        const response = await GET(makeRequest());
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
            (_request: unknown, callback: ZoektListCallback) => {
                setTimeout(() => callback(null, defaultZoektResponse), delay);
            },
        );

        const start = Date.now();
        const response = await GET(makeRequest());
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
                (_request: unknown, callback: ZoektListCallback) => {
                    callback(null, defaultZoektResponse);
                },
            );

            const response = await GET(makeRequest());
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
        const response = await GET(makeRequest());
        expect(response.status).toBe(200);
        expect(mocks.zoektList).toHaveBeenCalledTimes(1);
        expect(mocks.zoektList).toHaveBeenCalledWith({}, expect.any(Function));
    });

    describe('?strict=true', () => {
        test('returns 200 with status:ok and strict:true when Zoekt has at least one indexed repo', async () => {
            mocks.zoektList.mockImplementation(
                (_request: unknown, callback: ZoektListCallback) => {
                    callback(null, { repos: [{ repository: { name: 'foo' } }] });
                },
            );

            const response = await GET(makeRequest({ strict: 'true' }));
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.status).toBe('ok');
            expect(body.strict).toBe(true);
            expect(body.checks.zoekt.status).toBe('ok');
        });

        test('returns 503 with status:degraded and zoekt.status:"empty" when Zoekt has no indexed repos', async () => {
            mocks.zoektList.mockImplementation(
                (_request: unknown, callback: ZoektListCallback) => {
                    callback(null, { repos: [] });
                },
            );

            const response = await GET(makeRequest({ strict: 'true' }));
            const body = await response.json();

            expect(response.status).toBe(503);
            expect(body.status).toBe('degraded');
            expect(body.strict).toBe(true);
            expect(body.checks.zoekt.status).toBe('empty');
            expect(body.checks.zoekt.error).toContain('no repositories indexed');
            expect(body.checks.postgres.status).toBe('ok');
            expect(body.checks.redis.status).toBe('ok');
        });

        test('returns 503 in strict mode when the Zoekt response uses repos_map (RepoListFieldReposMap)', async () => {
            // The gRPC server may return `repos_map` (a numeric-keyed object)
            // when `ListOptions.Field = RepoListFieldReposMap`. Empty
            // `repos_map` should also be treated as empty in strict mode.
            mocks.zoektList.mockImplementation(
                (_request: unknown, callback: ZoektListCallback) => {
                    callback(null, { repos_map: {} });
                },
            );

            const response = await GET(makeRequest({ strict: 'true' }));
            const body = await response.json();

            expect(response.status).toBe(503);
            expect(body.checks.zoekt.status).toBe('empty');
        });

        test('returns 200 in strict mode when repos_map is non-empty', async () => {
            mocks.zoektList.mockImplementation(
                (_request: unknown, callback: ZoektListCallback) => {
                    callback(null, { repos_map: { 1: { repository: { name: 'bar' } } } });
                },
            );

            const response = await GET(makeRequest({ strict: 'true' }));
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.checks.zoekt.status).toBe('ok');
        });
    });

    describe('?strict=false and absent', () => {
        test('returns 200 with strict:false and zoekt.status:ok when Zoekt has zero repos', async () => {
            // Backward-compat: the default behavior must NOT consider an
            // empty Zoekt shard set as a failure. Operators who do not opt
            // in to strict mode should see the same response as before.
            mocks.zoektList.mockImplementation(
                (_request: unknown, callback: ZoektListCallback) => {
                    callback(null, { repos: [] });
                },
            );

            const response = await GET(makeRequest({ strict: 'false' }));
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.status).toBe('ok');
            expect(body.strict).toBe(false);
            expect(body.checks.zoekt.status).toBe('ok');
        });

        test('treats an absent strict parameter as strict:false', async () => {
            mocks.zoektList.mockImplementation(
                (_request: unknown, callback: ZoektListCallback) => {
                    callback(null, { repos: [] });
                },
            );

            const response = await GET(makeRequest());
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.strict).toBe(false);
            expect(body.checks.zoekt.status).toBe('ok');
        });
    });

    describe('invalid ?strict value', () => {
        test('returns 400 with a clear error message when strict is not parseable', async () => {
            const response = await GET(makeRequest({ strict: 'yes' }));
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.message).toBeDefined();
            expect(body.message).toMatch(/strict/);
        });
    });
});
