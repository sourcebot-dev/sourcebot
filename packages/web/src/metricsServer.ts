import { createLogger, env } from '@sourcebot/shared';
import { createServer, Server } from 'node:http';
import { registry } from './promClient';

const logger = createLogger('web-metrics-server');

/**
 * Serves the web process' Prometheus metrics on its own port, rather than as a
 * Next.js route, so that scraping doesn't pass through the app's middleware or
 * get exposed publicly through the ingress.
 */
export const startMetricsServer = (): Server | undefined => {
    // Guard against a missing port: `listen(undefined)` binds a random one, which
    // would leave the scrape target silently broken instead of loudly absent.
    const port = Number(env.WEB_METRICS_PORT);
    if (!Number.isInteger(port) || port <= 0) {
        logger.error(`Invalid WEB_METRICS_PORT '${env.WEB_METRICS_PORT}'; metrics server not started.`);
        return undefined;
    }

    const server = createServer(async (req, res) => {
        if (req.url !== '/metrics') {
            res.writeHead(404);
            res.end();
            return;
        }

        try {
            const metrics = await registry.metrics();
            res.writeHead(200, { 'Content-Type': registry.contentType });
            res.end(metrics);
        } catch (error) {
            logger.error(`Failed to collect metrics: ${error}`);
            res.writeHead(500);
            res.end();
        }
    });

    // Metrics must never take down the web server, so swallow listen failures
    // (a port collision, most likely) instead of letting the 'error' event throw.
    server.on('error', (error) => {
        logger.error(`Metrics server error: ${error}`);
    });

    server.listen(port, () => {
        logger.info(`Web metrics server listening on port ${port}`);
    });

    return server;
};
