import { createLogger } from '@sourcebot/shared';

import { apiHandler } from '@/lib/apiHandler';
import { __unsafePrisma } from '@/prisma';
import { getRedisClient } from '@/lib/redis';
import { loadZoektClient } from '@/lib/zoektClient';

// Per-check timeout. The three checks run in parallel, so the worst-case
// request time is bounded by this value even when one dependency hangs.
const READINESS_TIMEOUT_MS = 2000;

const logger = createLogger('health-ready');

type CheckStatus = 'ok' | 'error';
type CheckResult = {
    status: CheckStatus;
    latencyMs: number;
    error?: string;
};
type ReadinessResponse = {
    status: 'ok' | 'degraded';
    checks: {
        postgres: CheckResult;
        redis: CheckResult;
        zoekt: CheckResult;
    };
};

// Wraps a check function in a per-check timeout. When the timeout fires
// first, the check resolves as an error result; the underlying promise is
// allowed to settle in the background (its result is discarded).
const withTimeout = async <T>(
    label: string,
    check: () => Promise<T>,
    timeoutMs: number,
): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            reject(new Error(`${label} check timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });
    try {
        return await Promise.race([check(), timeout]);
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
};

const checkPostgres = async (): Promise<CheckResult> => {
    const start = Date.now();
    try {
        await withTimeout('postgres', async () => {
            await __unsafePrisma.$queryRaw`SELECT 1`;
        }, READINESS_TIMEOUT_MS);
        return { status: 'ok', latencyMs: Date.now() - start };
    } catch (err) {
        return {
            status: 'error',
            latencyMs: Date.now() - start,
            error: err instanceof Error ? err.message : String(err),
        };
    }
};

const checkRedis = async (): Promise<CheckResult> => {
    const start = Date.now();
    try {
        const redis = getRedisClient();
        await withTimeout('redis', async () => {
            const pong = await redis.ping();
            if (pong !== 'PONG') {
                throw new Error(`unexpected ping response: ${pong}`);
            }
        }, READINESS_TIMEOUT_MS);
        return { status: 'ok', latencyMs: Date.now() - start };
    } catch (err) {
        return {
            status: 'error',
            latencyMs: Date.now() - start,
            error: err instanceof Error ? err.message : String(err),
        };
    }
};

const checkZoekt = async (): Promise<CheckResult> => {
    const start = Date.now();
    try {
        const client = await loadZoektClient();
        await withTimeout('zoekt', async () => {
            await new Promise<void>((resolve, reject) => {
                // An empty List with a 1s wall-time cap is the smallest request
                // that exercises the gRPC channel end-to-end. It returns an
                // empty result, not an error, even when no repos are indexed.
                client.List(
                    { opts: { max_wall_time: { seconds: 1, nanos: 0 } } },
                    (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    },
                );
            });
        }, READINESS_TIMEOUT_MS);
        return { status: 'ok', latencyMs: Date.now() - start };
    } catch (err) {
        return {
            status: 'error',
            latencyMs: Date.now() - start,
            error: err instanceof Error ? err.message : String(err),
        };
    }
};

// eslint-disable-next-line authz/require-auth-wrapper -- public readiness probe, no user data returned
export const GET = apiHandler(async () => {
    const [postgres, redis, zoekt] = await Promise.all([
        checkPostgres(),
        checkRedis(),
        checkZoekt(),
    ]);

    const checks = { postgres, redis, zoekt };
    const healthy = postgres.status === 'ok' && redis.status === 'ok' && zoekt.status === 'ok';

    if (!healthy) {
        logger.warn('readiness check failed', { checks });
    }

    const body: ReadinessResponse = {
        status: healthy ? 'ok' : 'degraded',
        checks,
    };
    return Response.json(body, { status: healthy ? 200 : 503 });
}, { track: false });
