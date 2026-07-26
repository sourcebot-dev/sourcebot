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

// Runs `check()` and rejects if it has not settled after `timeoutMs`. When the
// timeout fires, the underlying check promise may still resolve or reject
// later; the no-op `.catch` below attaches to that promise so a late
// rejection does not surface as an unhandled-promise-rejection in the Node
// process while the readiness request has already moved on.
const withTimeout = async <T>(
    label: string,
    check: () => Promise<T>,
    timeoutMs: number,
): Promise<T> => {
    const checkPromise = check();
    checkPromise.catch(() => { /* swallowed: see comment above */ });

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            reject(new Error(`${label} check timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });
    try {
        return await Promise.race([checkPromise, timeout]);
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
        await withTimeout('zoekt', async () => {
            // Build the client inside the timeout so a first-call init stall
            // (e.g., vendored proto load) is also bounded.
            const client = await loadZoektClient();
            await new Promise<void>((resolve, reject) => {
                // Empty `List` is the smallest request that exercises the gRPC
                // channel end-to-end. It returns an empty result, not an error,
                // even when no repos are indexed. The 2s client-side
                // `READINESS_TIMEOUT_MS` is the only timeout that actually
                // bounds the call: `max_wall_time` is a `SearchOptions` field
                // and does not apply to `List` (`ListOptions` only carries
                // `field`).
                client.List({}, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
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
