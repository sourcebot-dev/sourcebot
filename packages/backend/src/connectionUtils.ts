import * as Sentry from "@sentry/node";

export function processPromiseResults<T>(
    results: PromiseSettledResult<T[]>[],
): T[] {
    return results.flatMap((result) =>
        result.status === "fulfilled" ? result.value : []
    );
}

export function throwIfAnyFailed<T>(results: PromiseSettledResult<T>[]) {
    const failedResult = results.find(result => result.status === 'rejected');
    if (failedResult) {
        Sentry.captureException(failedResult.reason);
        throw failedResult.reason;
    }
}
