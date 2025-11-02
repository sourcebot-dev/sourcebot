'use server';

import { createLogger } from "@sourcebot/shared";

const logger = createLogger('health-check');

export async function GET() {
    logger.info('health check');
    return Response.json({ status: 'ok' });
}

