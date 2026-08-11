import { createLogger, env } from '@sourcebot/shared';
import { subscribe } from 'node:diagnostics_channel';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { httpRequestDuration } from './promClient';

const logger = createLogger('web-http-metrics');

/**
 * Collapses a request path into a bounded label.
 *
 * The full path can't be used: repository and file paths are unbounded, so
 * `/browse/github.com/org/repo/-/blob/src/index.ts` would mint a new time
 * series for every file anyone views. API paths keep two segments so
 * `/api/health` stays distinct from `/api/commits`; everything else keeps one.
 * That bounds the label to roughly the number of API routes plus top-level
 * pages.
 */
export const normalizeRoute = (pathname: string): string => {
    const segments = pathname.split('/').filter(segment => segment.length > 0);
    if (segments.length === 0) {
        return '/';
    }

    const depth = segments[0] === 'api' ? 2 : 1;
    return `/${segments.slice(0, depth).join('/')}`;
};

interface RequestStartMessage {
    response?: ServerResponse;
    socket?: { localPort?: number };
}

interface ResponseFinishMessage {
    request?: IncomingMessage;
    response?: ServerResponse;
}

const startTimes = new WeakMap<ServerResponse, number>();
let subscribed = false;

/**
 * Records request durations by subscribing to Node's built-in HTTP diagnostics
 * channels. Next.js owns the server instance in a standalone build, so there's
 * no request pipeline to wrap; these channels observe every request without
 * patching anything.
 *
 * Requests to the metrics port are skipped — the channels are process-wide, so
 * without that filter every scrape would record itself.
 */
export const startHttpMetrics = (): void => {
    if (subscribed) {
        return;
    }
    subscribed = true;

    const metricsPort = Number(env.WEB_METRICS_PORT);

    subscribe('http.server.request.start', (message) => {
        try {
            const { response, socket } = message as RequestStartMessage;
            if (!response || socket?.localPort === metricsPort) {
                return;
            }
            startTimes.set(response, performance.now());
        } catch (error) {
            logger.debug(`Failed to record request start: ${error}`);
        }
    });

    subscribe('http.server.response.finish', (message) => {
        try {
            const { request, response } = message as ResponseFinishMessage;
            if (!request || !response) {
                return;
            }

            const startedAt = startTimes.get(response);
            if (startedAt === undefined) {
                return;
            }
            startTimes.delete(response);

            const pathname = (request.url ?? '/').split('?')[0];
            httpRequestDuration.observe(
                {
                    method: request.method ?? 'UNKNOWN',
                    route: normalizeRoute(pathname),
                    status: response.statusCode,
                },
                (performance.now() - startedAt) / 1000,
            );
        } catch (error) {
            logger.debug(`Failed to record request duration: ${error}`);
        }
    });

    logger.info('HTTP request duration metrics enabled.');
};
