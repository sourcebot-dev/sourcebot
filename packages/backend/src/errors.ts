
type HttpErrorDetails = {
    status: number | null;
    headers?: unknown;
};

/**
 * Normalizes HTTP response metadata across the code-host client libraries:
 *   - Octokit RequestError: { status, response: { headers } }
 *   - openapi-fetch (Bitbucket Cloud / Server): { status }
 *   - gitbeaker (GitLab): { cause: { response: { status, headers } } }
 */
const getHttpErrorDetails = (error: unknown): HttpErrorDetails => {
    if (error === null || typeof error !== 'object') {
        return { status: null };
    }

    const directError = error as {
        status?: unknown;
        response?: { status?: unknown; headers?: unknown };
        cause?: { response?: { status?: unknown; headers?: unknown } };
    };
    const directResponse = directError.response;
    const nestedResponse = directError.cause?.response;
    const status = [
        directError.status,
        directResponse?.status,
        nestedResponse?.status,
    ].find((value): value is number => typeof value === 'number') ?? null;

    return {
        status,
        headers: directResponse?.headers ?? nestedResponse?.headers,
    };
};

export const getErrorStatus = (error: unknown): number | null =>
    getHttpErrorDetails(error).status;

export const getErrorHeader = (error: unknown, name: string): string | undefined => {
    const { headers } = getHttpErrorDetails(error);

    if (headers instanceof Headers) {
        return headers.get(name) ?? undefined;
    }

    if (headers !== null && typeof headers === 'object') {
        const normalizedName = name.toLowerCase();
        const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === normalizedName);
        return typeof entry?.[1] === 'string' ? entry[1] : undefined;
    }

    return undefined;
};

export const isUnauthorized = (err: unknown): boolean => getErrorStatus(err) === 401;
export const isForbidden = (err: unknown): boolean => getErrorStatus(err) === 403;
export const isNotFound = (err: unknown): boolean => getErrorStatus(err) === 404;
export const isGone = (err: unknown): boolean => getErrorStatus(err) === 410;
