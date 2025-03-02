// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://d1102cafbf02e1d3ed04a6de141b1dce@o4508802051932160.ingest.us.sentry.io/4508905421078528",
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 'unknown',

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
});
