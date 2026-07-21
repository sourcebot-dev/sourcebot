// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
//
// Must be named `instrumentation-client.ts`. Next.js loads this file itself, whereas
// `sentry.client.config.ts` is only picked up by @sentry/nextjs' webpack plugin,
// which never runs since `next build` defaults to Turbopack.

import * as Sentry from "@sentry/nextjs";

if (!!process.env.NEXT_PUBLIC_SENTRY_WEBAPP_DSN && !!process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT) {
    Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_WEBAPP_DSN,
        environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
        sampleRate: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT === 'development' ? 1.0 : 0.1,
        integrations: [
            Sentry.browserProfilingIntegration(),
        ],
        tracesSampleRate: 1.0,
        // Evaluated once per `Sentry.init()`, i.e. once per page load.
        profileSessionSampleRate: 1.0,
        // Profile only while a sampled root span is active, rather than continuously.
        profileLifecycle: 'trace',
    });
} else {
    console.debug("[client] Sentry was not initialized");
}

// Instruments App Router client-side navigations as spans. Next.js only reads this
// export from `instrumentation-client.ts`. A no-op when Sentry is uninitialized.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
