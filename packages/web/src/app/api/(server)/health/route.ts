'use server';

import { apiHandler } from "@/lib/apiHandler";
import { createLogger } from "@sourcebot/shared";

const logger = createLogger('health-check');

export const GET = apiHandler(async () => {
    logger.info('health check');
    return Response.json({ status: 'ok' });
}, { track: false });

