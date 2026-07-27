'use server';

import { NextRequest } from 'next/server';

import { SOURCEBOT_VERSION, createLogger } from '@sourcebot/shared';

import { apiHandler } from '@/lib/apiHandler';

// `startedAt` and `startedAtMs` are captured at module load. The handler
// returns a frozen timestamp for the lifetime of the process, so two
// `curl` calls report the same `startedAt` and an `uptime` that increases
// monotonically between them.
const startedAtMs = Date.now();
const startedAt = new Date(startedAtMs).toISOString();

const logger = createLogger('health-check');

type HealthResponse = {
    status: 'ok';
    version: string;
    startedAt: string;
    uptime: number;
    pid: number;
    node: {
        version: string;
        platform: string;
        arch: string;
    };
};

// eslint-disable-next-line authz/require-auth-wrapper -- public liveness probe, no user data returned
export const GET = apiHandler(async (_request: NextRequest): Promise<Response> => {
    logger.debug('health check');
    const body: HealthResponse = {
        status: 'ok',
        version: SOURCEBOT_VERSION,
        startedAt,
        uptime: Math.floor((Date.now() - startedAtMs) / 1000),
        pid: process.pid,
        node: {
            version: process.version,
            platform: process.platform,
            arch: process.arch,
        },
    };
    return Response.json(body);
}, { track: false });
