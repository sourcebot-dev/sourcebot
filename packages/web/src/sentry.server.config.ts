// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { createLogger } from "@sourcebot/shared";

const logger = createLogger('sentry-server-config');

if (!!process.env.NEXT_PUBLIC_SENTRY_WEBAPP_DSN && !!process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT) {
    const enablePerformanceMonitoring = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT === 'development';

    Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_WEBAPP_DSN,
        environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
        // Sentry's server tracing and profiling retain completed Next.js request
        // async contexts under sustained SSR traffic. Keep production error
        // reporting enabled without those per-request telemetry paths.
        ...(enablePerformanceMonitoring ? {
            integrations: [
                nodeProfilingIntegration(),
            ],
            tracesSampleRate: 1.0,
            // Evaluated once per `Sentry.init()`, i.e. once per server process.
            profileSessionSampleRate: 1.0,
            // Profile only while a sampled root span is active, rather than continuously.
            profileLifecycle: 'trace' as const,
        } : {}),
    });
} else {
    logger.debug("[server] Sentry was not initialized");
}
