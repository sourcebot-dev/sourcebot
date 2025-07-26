'use server';

import { createLogger } from "@sourcebot/logger";

const logger = createLogger('health-check');

export async function GET() {
    logger.info('health check');
    return Response.json({ status: 'ok' });
}

