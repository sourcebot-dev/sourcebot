import { ServiceError, ServiceErrorException, unexpectedError } from "@/lib/serviceError";
import { createLogger } from "@sourcebot/shared";
import * as Sentry from "@sentry/nextjs";

const logger = createLogger('sew');


/**
 * "Service Error Wrapper".
 *
 * Captures any thrown exceptions, logs them to the console and Sentry,
 * and returns a generic unexpected service error.
 */
export const sew = async <T>(fn: () => Promise<T>): Promise<T | ServiceError> => {
    try {
        return await fn();
    } catch (e) {
        Sentry.captureException(e);
        logger.error(e);

        if (e instanceof ServiceErrorException) {
            return e.serviceError;
        }

        return unexpectedError(`An unexpected error occurred. Please try again later.`);
    }
};
