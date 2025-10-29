import * as Sentry from "@sentry/node";

type ValidResult<T> = {
    type: 'valid';
    data: T[];
};

type WarningResult = {
    type: 'warning';
    warning: string;
};

type CustomResult<T> = ValidResult<T> | WarningResult;

export function processPromiseResults<T>(
    results: PromiseSettledResult<CustomResult<T>>[],
): {
    validItems: T[];
    warnings: string[];
} {
    const validItems: T[] = [];
    const warnings: string[] = [];

    results.forEach(result => {
        if (result.status === 'fulfilled') {
            const value = result.value;
            if (value.type === 'valid') {
                validItems.push(...value.data);
            } else {
                warnings.push(value.warning);
            }
        }
    });

    return {
        validItems,
        warnings,
    };
}

export function throwIfAnyFailed<T>(results: PromiseSettledResult<T>[]) {
    const failedResult = results.find(result => result.status === 'rejected');
    if (failedResult) {
        Sentry.captureException(failedResult.reason);
        throw failedResult.reason;
    }
}