import 'server-only';

import { createRedisClient } from '@sourcebot/shared';

let redis: ReturnType<typeof createRedisClient> | undefined;

export function getRedisClient() {
    redis ??= createRedisClient();
    return redis;
}
