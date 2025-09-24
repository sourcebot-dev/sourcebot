'use server';
import * as Sentry from "@sentry/nextjs";
import { ServiceError, unexpectedError } from "./lib/serviceError";
import { createLogger } from "@sourcebot/logger";

const logger = createLogger('service-error-wrapper');

/**
 * "Service Error Wrapper".
 *
 * Captures any thrown exceptions and converts them to a unexpected
 * service error. Also logs them with Sentry.
 */

export const sew = async <T>(fn: () => Promise<T>): Promise<T | ServiceError> => {
    try {
        return await fn();
    } catch (e) {
        Sentry.captureException(e);
        logger.error(e);

        if (e instanceof Error) {
            return unexpectedError(e.message);
        }

        return unexpectedError(`An unexpected error occurred. Please try again later.`);
    }
};
