import 'server-only';

import { BullMQClient } from '@sourcebot/shared';
import { getRedisClient } from './redis';

let client: BullMQClient | undefined;

export function getBullMQClient() {
    client ??= new BullMQClient(getRedisClient());
    return client;
}
