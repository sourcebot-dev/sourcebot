'use server';

import { NextRequest } from 'next/server';

import { SOURCEBOT_VERSION, createLogger } from '@sourcebot/shared';

import { apiHandler } from '@/lib/apiHandler';

// `processStartedAtMs` is the wall-clock time the process started, derived
// once at module load from `Date.now() - process.uptime() * 1000`. We anchor
// on `process.uptime()` (which is monotonic relative to process boot, immune
// to NTP steps that move the wall clock) rather than capturing
// `Date.now()` directly, so the resulting `startedAt` is anchored to the
// actual process start even when the route module is lazy-loaded by
// Next.js well after the process booted.
//
// `startedAt` is the wall-clock ISO 8601 timestamp at process boot.
// `uptime` is `process.uptime()` (seconds since process boot), always
// monotonic. Both are anchored to the process, not the module.
const processStartedAtMs = Date.now() - Math.floor(process.uptime() * 1000);
const startedAt = new Date(processStartedAtMs).toISOString();

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
        uptime: Math.floor(process.uptime()),
        pid: process.pid,
        node: {
            version: process.version,
            platform: process.platform,
            arch: process.arch,
        },
    };
    return Response.json(body);
}, { track: false });
