import 'server-only';

import { BullMQClient } from '@sourcebot/shared';
import { getRedisClient } from './redis';
import { __unsafePrisma } from '@/prisma';

let client: BullMQClient | undefined;

export function getBullMQClient() {
    client ??= new BullMQClient(getRedisClient(), __unsafePrisma);
    return client;
}
