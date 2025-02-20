type ValidResult<T> = {
    type: 'valid';
    data: T[];
};

type NotFoundResult = {
    type: 'notFound';
    value: string;
};

type CustomResult<T> = ValidResult<T> | NotFoundResult;

export function processPromiseResults<T>(
    results: PromiseSettledResult<CustomResult<T>>[],
): {
    validItems: T[];
    notFoundItems: string[];
} {
    const validItems: T[] = [];
    const notFoundItems: string[] = [];

    results.forEach(result => {
        if (result.status === 'fulfilled') {
            const value = result.value;
            if (value.type === 'valid') {
                validItems.push(...value.data);
            } else {
                notFoundItems.push(value.value);
            }
        }
    });

    return {
        validItems,
        notFoundItems,
    };
}

export function throwIfAnyFailed<T>(results: PromiseSettledResult<T>[]) {
    const failedResult = results.find(result => result.status === 'rejected');
    if (failedResult) {
        throw failedResult.reason;
    }
}