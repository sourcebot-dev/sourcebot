import { createLogger, env } from '@sourcebot/shared';
import { subscribe } from 'node:diagnostics_channel';
import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { httpRequestDuration } from './promClient';

const logger = createLogger('web-http-metrics');

interface RoutesManifest {
    staticRoutes: { page: string }[];
    dynamicRoutes: { page: string; regex: string }[];
    rewrites?: {
        beforeFiles?: { source: string; regex: string }[];
        afterFiles?: { source: string; regex: string }[];
        fallback?: { source: string; regex: string }[];
    };
}

interface RewriteRoute {
    source: string;
    regex: RegExp;
}

interface RouteTable {
    staticPages: Set<string>;
    dynamicRoutes: { page: string; regex: RegExp }[];
    beforeFilesRewrites: RewriteRoute[];
    afterFilesRewrites: RewriteRoute[];
    fallbackRewrites: RewriteRoute[];
}

const OTHER_ROUTE = 'other';

const matchRewrite = (pathname: string, rewrites: RewriteRoute[]): string | undefined => {
    return rewrites.find(rewrite => rewrite.regex.test(pathname))?.source;
};

/**
 * Builds a route matcher from Next's routes-manifest. The manifest lists every
 * defined route with a matching regex, ordered by Next's own resolution
 * priority (specific routes before catch-alls), so first-match-wins here
 * agrees with how the server actually routes the request.
 */
export const buildRouteTable = (manifest: RoutesManifest): RouteTable => {
    const buildRewrites = (rewrites: { source: string; regex: string }[] | undefined): RewriteRoute[] => {
        return (rewrites ?? []).map(rewrite => ({
            source: rewrite.source,
            regex: new RegExp(rewrite.regex),
        }));
    };

    return {
        staticPages: new Set(manifest.staticRoutes.map(route => route.page)),
        dynamicRoutes: manifest.dynamicRoutes.map(route => ({
            page: route.page,
            regex: new RegExp(route.regex),
        })),
        beforeFilesRewrites: buildRewrites(manifest.rewrites?.beforeFiles),
        afterFilesRewrites: buildRewrites(manifest.rewrites?.afterFiles),
        fallbackRewrites: buildRewrites(manifest.rewrites?.fallback),
    };
};

let routeTable: RouteTable | undefined;

/**
 * Loads the route table from the build's routes-manifest. Next's standalone
 * server chdirs to the app directory on boot, so the manifest sits at
 * `.next/routes-manifest.json` relative to cwd.
 *
 * Deriving routes from the manifest (rather than a hardcoded list) keeps the
 * label set in sync with the app automatically: new routes appear at build
 * time, and the label is the route or rewrite pattern itself
 * (`/browse/[...path]`), so cardinality is bounded by the number of defined
 * routes and rewrites no matter what gets requested.
 */
export const initRouteTable = (manifest?: RoutesManifest): boolean => {
    try {
        const resolved = manifest ?? (JSON.parse(
            readFileSync(path.join(process.cwd(), '.next', 'routes-manifest.json'), 'utf-8'),
        ) as RoutesManifest);
        routeTable = buildRouteTable(resolved);
        const rewriteCount = routeTable.beforeFilesRewrites.length
            + routeTable.afterFilesRewrites.length
            + routeTable.fallbackRewrites.length;
        logger.info(
            `Route table loaded: ${routeTable.staticPages.size} static, ${routeTable.dynamicRoutes.length} dynamic, ${rewriteCount} rewrite routes.`,
        );
        return true;
    } catch (error) {
        // Fail closed: without a table every request is labelled `other`, which
        // loses granularity but can never grow the label set.
        routeTable = undefined;
        logger.error(`Failed to load routes-manifest; all routes will be reported as '${OTHER_ROUTE}': ${error}`);
        return false;
    }
};

/**
 * Maps a request path to its route pattern. The raw path can't be used as a
 * label: repository and file paths are unbounded, so `/browse/...` would mint
 * a new time series for every file anyone views, and unknown paths (scanners,
 * bots) would grow the set without limit. Matching against the app's own
 * routes bounds the label set to the number of defined routes and rewrite
 * sources plus `/_next` and `other`.
 */
export const normalizeRoute = (pathname: string, table: RouteTable | undefined = routeTable): string => {
    const segments = pathname.split('/').filter(segment => segment.length > 0);
    if (segments.length === 0) {
        return '/';
    }

    // Asset requests are real traffic but not manifest routes.
    if (segments[0] === '_next') {
        return '/_next';
    }

    if (!table) {
        return OTHER_ROUTE;
    }

    const canonical = `/${segments.join('/')}`;

    // Preserve Next's routing order. Rewrite source patterns are the stable,
    // public-facing route labels; resolving destinations here would require
    // duplicating Next's parameter interpolation and rewrite chaining.
    const beforeFilesRewrite = matchRewrite(canonical, table.beforeFilesRewrites);
    if (beforeFilesRewrite) {
        return beforeFilesRewrite;
    }

    if (table.staticPages.has(canonical)) {
        return canonical;
    }

    const afterFilesRewrite = matchRewrite(canonical, table.afterFilesRewrites);
    if (afterFilesRewrite) {
        return afterFilesRewrite;
    }

    for (const route of table.dynamicRoutes) {
        if (route.regex.test(canonical)) {
            return route.page;
        }
    }

    const fallbackRewrite = matchRewrite(canonical, table.fallbackRewrites);
    if (fallbackRewrite) {
        return fallbackRewrite;
    }

    return OTHER_ROUTE;
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

    if (!routeTable) {
        initRouteTable();
    }

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
