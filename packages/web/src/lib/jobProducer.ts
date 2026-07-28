import 'server-only';

import { BullMQJobProducer } from '@sourcebot/shared';
import { getRedisClient } from './redis';

let jobProducer: BullMQJobProducer | undefined;

export function getJobProducer() {
    jobProducer ??= new BullMQJobProducer(getRedisClient());
    return jobProducer;
}
