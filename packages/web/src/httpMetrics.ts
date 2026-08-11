import { createLogger, env } from '@sourcebot/shared';
import { subscribe } from 'node:diagnostics_channel';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { httpRequestDuration } from './promClient';

const logger = createLogger('web-http-metrics');

/**
 * Every path that isn't in this set is reported as `other`.
 *
 * Truncating path depth alone does not bound cardinality: the first segment is
 * client-supplied, and `/api/[...slug]` is a catch-all, so `/wp-admin`,
 * `/.env`, and `/api/<anything>` would each mint a new time series. Scanner or
 * bot traffic would then grow the series count without limit. Matching against
 * a known set instead bounds it to this size plus one, whatever gets requested.
 *
 * Adding a route here is deliberate. A missing one is reported as `other`, so
 * new routes lose granularity rather than breaking, and cardinality holds.
 */
const KNOWN_ROUTES = new Set([
    '/',
    '/_next',
    '/askgh',
    '/browse',
    '/chat',
    '/chats',
    '/invite',
    '/login',
    '/oauth',
    '/onboard',
    '/redeem',
    '/repos',
    '/search',
    '/settings',
    '/signup',
    '/slow',
    '/api/auth',
    '/api/avatar',
    '/api/blame',
    '/api/changelog',
    '/api/chat',
    '/api/commit',
    '/api/commits',
    '/api/diff',
    '/api/ee',
    '/api/files',
    '/api/find_definitions',
    '/api/find_references',
    '/api/folder_contents',
    '/api/health',
    '/api/minidenticon',
    '/api/models',
    '/api/offers',
    '/api/openapi.json',
    '/api/repo-status',
    '/api/repos',
    '/api/search',
    '/api/source',
    '/api/stream_search',
    '/api/symbols',
    '/api/tree',
    '/api/version',
    '/api/webhook',
]);

const OTHER_ROUTE = 'other';

/**
 * Collapses a request path into a bounded label.
 *
 * Depth is truncated first, because repository and file paths are unbounded and
 * `/browse/github.com/org/repo/-/blob/src/index.ts` must not mint a series per
 * file viewed. API paths keep two segments so `/api/health` stays distinct from
 * `/api/commits`; everything else keeps one. The result is then matched against
 * `KNOWN_ROUTES`, which is what actually bounds the label set.
 */
export const normalizeRoute = (pathname: string): string => {
    const segments = pathname.split('/').filter(segment => segment.length > 0);
    if (segments.length === 0) {
        return '/';
    }

    const depth = segments[0] === 'api' ? 2 : 1;
    const candidate = `/${segments.slice(0, depth).join('/')}`;

    return KNOWN_ROUTES.has(candidate) ? candidate : OTHER_ROUTE;
};

/** Upper bound on distinct `route` label values, for tests and review. */
export const MAX_ROUTE_LABELS = KNOWN_ROUTES.size + 1;

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
