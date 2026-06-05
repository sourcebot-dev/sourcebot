'use server';

import { apiHandler } from "@/lib/apiHandler";
import { createLogger } from "@sourcebot/shared";

const logger = createLogger('health-check');

// eslint-disable-next-line authz/require-auth-wrapper -- public health check, no user data returned
export const GET = apiHandler(async () => {
    logger.debug('health check');
    return Response.json({ status: 'ok' });
}, { track: false });

