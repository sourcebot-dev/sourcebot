import * as Sentry from "@sentry/node";
import { SOURCEBOT_VERSION, SENTRY_DSN } from "./environment.js";

Sentry.init({
  dsn: SENTRY_DSN,
  release: SOURCEBOT_VERSION,
});
