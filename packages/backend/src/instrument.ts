import * as Sentry from "@sentry/node";
import { createLogger, SOURCEBOT_VERSION } from "@sourcebot/shared";
import { env } from "@sourcebot/shared/client";

const logger = createLogger('instrument');

if (!!env.NEXT_PUBLIC_SENTRY_BACKEND_DSN && !!env.NEXT_PUBLIC_SENTRY_ENVIRONMENT) {
    Sentry.init({
        dsn: env.NEXT_PUBLIC_SENTRY_BACKEND_DSN,
        // Must match the release our source maps are uploaded under, which the
        // Dockerfile sets from SENTRY_RELEASE (the build's commit SHA). Falls back
        // to the version for builds that don't pass a commit SHA.
        release: env.NEXT_PUBLIC_BUILD_COMMIT_SHA ?? SOURCEBOT_VERSION,
        environment: env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
        sampleRate: env.NEXT_PUBLIC_SENTRY_ENVIRONMENT === 'development' ? 1.0 : 0.1,
    });
} else {
    logger.debug("Sentry was not initialized");
}
