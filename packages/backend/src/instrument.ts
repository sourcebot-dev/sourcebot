import * as Sentry from "@sentry/node";
import { createLogger } from "@sourcebot/logger";
import { env } from "@sourcebot/shared";

const logger = createLogger('instrument');

if (!!env.NEXT_PUBLIC_SENTRY_BACKEND_DSN && !!env.NEXT_PUBLIC_SENTRY_ENVIRONMENT) {
    Sentry.init({
        dsn: env.NEXT_PUBLIC_SENTRY_BACKEND_DSN,
        release: env.NEXT_PUBLIC_SOURCEBOT_VERSION,
        environment: env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    });
} else {
    logger.debug("Sentry was not initialized");
}
