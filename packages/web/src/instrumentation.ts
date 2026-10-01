import * as Sentry from '@sentry/nextjs';
import type { ServerResponse } from 'node:http';

export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        await import('./sentry.server.config');
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
        await import('./sentry.edge.config');
    }

    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Proxied rewrites (`/ingest/*` for PostHog, the `/monitoring` Sentry
        // tunnel) legitimately attach 11 `close` listeners to each response: 9
        // from Next's rewrite proxy plus 2 from Sentry. That crosses Node's
        // default limit of 10 and logs a MaxListenersExceededWarning on every
        // such request, even though the listeners are released with the
        // response. The request start channel fires before Next handles the
        // request, and scoping the raise to responses keeps the warning
        // meaningful for every other emitter. This can be removed once Next
        // trims its proxy listeners.
        // @see: https://github.com/vercel/next.js/issues/97757
        const { subscribe } = await import('node:diagnostics_channel');
        subscribe('http.server.request.start', (message) => {
            (message as { response?: ServerResponse }).response?.setMaxListeners(20);
        });

        const { startMetricsServer } = await import('./metricsServer');
        startMetricsServer();

        const { startHttpMetrics } = await import('./httpMetrics');
        startHttpMetrics();
    }

    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { initialize } = await import('./initialize');
        await initialize();
    }
}

export const onRequestError = Sentry.captureRequestError;
