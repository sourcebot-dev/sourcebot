import * as Sentry from "@sentry/node";
import { env } from "./env.js";

Sentry.init({
  dsn: env.SENTRY_BACKEND_DSN,
  release: env.SOURCEBOT_VERSION,
  environment: env.SENTRY_ENVIRONMENT,
});
