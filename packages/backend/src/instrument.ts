import * as Sentry from "@sentry/node";
import { SOURCEBOT_VERSION, SENTRY_BACKEND_DSN, SENTRY_ENVIRONMENT } from "./environment.js";

Sentry.init({
  dsn: SENTRY_BACKEND_DSN,
  release: SOURCEBOT_VERSION,
  environment: SENTRY_ENVIRONMENT,
});
