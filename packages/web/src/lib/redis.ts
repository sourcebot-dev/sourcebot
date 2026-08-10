import 'server-only';

import { createRedisClient } from '@sourcebot/shared';

let redis: ReturnType<typeof createRedisClient> | undefined;

const REDIS_REQUEST_TIMEOUT_MS = 5000;

export function getRedisClient() {
    redis ??= createRedisClient({
        commandTimeout: REDIS_REQUEST_TIMEOUT_MS,
        connectTimeout: REDIS_REQUEST_TIMEOUT_MS,
        maxRetriesPerRequest: 1,
    });
    return redis;
}
