import { createLogger } from '@sourcebot/shared';
import { NextRequest } from 'next/server';
import { z } from 'zod';

import { apiHandler } from '@/lib/apiHandler';
import { __unsafePrisma } from '@/prisma';
import { getRedisClient } from '@/lib/redis';
import { queryParamsSchemaValidationError, serviceErrorResponse } from '@/lib/serviceError';
import { loadZoektClient, ZoektListResponse } from '@/lib/zoektClient';

// Per-check timeout. The three checks run in parallel, so the worst-case
// request time is bounded by this value even when one dependency hangs.
const READINESS_TIMEOUT_MS = 2000;

const logger = createLogger('health-ready');

type CheckStatus = 'ok' | 'error' | 'empty';
type CheckResult = {
    status: CheckStatus;
    latencyMs: number;
    error?: string;
};
type ReadinessResponse = {
    status: 'ok' | 'degraded';
    strict: boolean;
    checks: {
        postgres: CheckResult;
        redis: CheckResult;
        zoekt: CheckResult;
    };
};

const queryParamsSchema = z.object({
    // `z.coerce.boolean()` is a footgun: it just calls `Boolean(value)` and
    // would treat the string `"false"` as truthy. Accept only the two
    // literal strings we mean to support and transform to a boolean.
    strict: z
        .string()
        .optional()
        .refine(
            (v) => v === undefined || v === 'true' || v === 'false',
            { message: 'strict must be "true" or "false"' },
        )
        .transform((v) => v === 'true'),
});

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

const checkZoekt = async (strict: boolean): Promise<CheckResult> => {
    const start = Date.now();
    try {
        // The List response is captured so the strict path can decide
        // whether the empty-shard case is acceptable.
        const response = await withTimeout('zoekt', async () => {
            // Build the client inside the timeout so a first-call init stall
            // (e.g., vendored proto load) is also bounded.
            const client = await loadZoektClient();
            return await new Promise<ZoektListResponse>((resolve, reject) => {
                // Empty `List` is the smallest request that exercises the
                // gRPC channel end-to-end. It returns an empty result, not
                // an error, even when no repos are indexed. The 2s
                // client-side `READINESS_TIMEOUT_MS` is the only timeout
                // that actually bounds the call: `max_wall_time` is a
                // `SearchOptions` field and does not apply to `List`
                // (`ListOptions` only carries `field`).
                client.List({}, (err, result) => {
                    // `zoektSearch` rejects when the callback fires with
                    // no error but no response either (see
                    // `features/search/zoektSearcher.ts`). Do the same
                    // here: a missing result would otherwise throw on
                    // `response.repos` and surface as a generic `error`
                    // instead of the intended `empty` strict-mode status.
                    if (err) {
                        reject(err);
                    } else if (!result) {
                        reject(new Error('zoekt List RPC returned no response'));
                    } else {
                        resolve(result);
                    }
                });
            });
        }, READINESS_TIMEOUT_MS);

        if (strict) {
            // Check both `repos` (Field = RepoListFieldRepos) and
            // `repos_map` (Field = RepoListFieldReposMap) so the result is
            // correct regardless of which field the server populates.
            const repos = response.repos ?? [];
            const reposMap = response.repos_map ?? {};
            if (repos.length === 0 && Object.keys(reposMap).length === 0) {
                return {
                    status: 'empty',
                    latencyMs: Date.now() - start,
                    error: 'no repositories indexed (strict mode)',
                };
            }
        }

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
export const GET = apiHandler(async (request: NextRequest) => {
    const rawParams = {
        strict: request.nextUrl.searchParams.get('strict') ?? undefined,
    };
    const parsed = queryParamsSchema.safeParse(rawParams);

    if (!parsed.success) {
        return serviceErrorResponse(
            queryParamsSchemaValidationError(parsed.error)
        );
    }

    const { strict } = parsed.data;

    const [postgres, redis, zoekt] = await Promise.all([
        checkPostgres(),
        checkRedis(),
        checkZoekt(strict),
    ]);

    const checks = { postgres, redis, zoekt };
    const healthy = postgres.status === 'ok' && redis.status === 'ok' && zoekt.status === 'ok';

    if (!healthy) {
        logger.warn('readiness check failed', { checks, strict });
    }

    const body: ReadinessResponse = {
        status: healthy ? 'ok' : 'degraded',
        strict,
        checks,
    };
    return Response.json(body, { status: healthy ? 200 : 503 });
}, { track: false });
