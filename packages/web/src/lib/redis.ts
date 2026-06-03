import 'server-only';

import { createRedisClient } from '@sourcebot/shared';

export const redis = createRedisClient();
