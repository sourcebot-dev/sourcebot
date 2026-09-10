// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { createLogger } from "@sourcebot/shared";

const logger = createLogger('sentry-server-config');
const isTracingEnabled = process.env.SENTRY_TRACING_ENABLED === 'true';
const isProfilingEnabled = isTracingEnabled && process.env.SENTRY_PROFILING_ENABLED === 'true';

if (!!process.env.NEXT_PUBLIC_SENTRY_WEBAPP_DSN && !!process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT) {
    Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_WEBAPP_DSN,
        environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
        ...(isTracingEnabled ? {
            tracesSampleRate: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT === 'development' ? 1.0 : 0.1,
        } : {}),
        ...(isProfilingEnabled ? {
            integrations: [
                nodeProfilingIntegration(),
            ],
            // Evaluated once per `Sentry.init()`, i.e. once per server process.
            profileSessionSampleRate: 1.0,
            // Profile only while a sampled root span is active, rather than continuously.
            profileLifecycle: 'trace' as const,
        } : {}),
    });
} else {
    logger.debug("[server] Sentry was not initialized");
}
