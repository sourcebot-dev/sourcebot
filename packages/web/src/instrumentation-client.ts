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

        tracesSampleRate: 1.0,

        // Setting this option to true will print useful information to the console while you're setting up Sentry.
        debug: false,
    });
} else {
    console.debug("[client] Sentry was not initialized");
}

// Instruments App Router client-side navigations as spans. Next.js only reads this
// export from `instrumentation-client.ts`. A no-op when Sentry is uninitialized.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
