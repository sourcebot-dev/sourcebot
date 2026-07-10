
/**
 * Extract an HTTP status code from a thrown error across the libraries used by
 * the code-host clients:
 *   - Octokit RequestError: { status }
 *   - openapi-fetch (Bitbucket Cloud / Server): direct throws with { status }
 *     or errors wrapped via Object.assign(new Error(...), { status })
 *   - gitbeaker (GitLab): { cause: { response: { status } } }
 */
const getStatus = (err: unknown): number | null => {
    if (err === null || typeof err !== 'object') {
        return null;
    }

    const direct = (err as { status?: unknown }).status;
    if (typeof direct === 'number') {
        return direct;
    }

    const nested = (err as { cause?: { response?: { status?: unknown } } }).cause?.response?.status;
    if (typeof nested === 'number') {
        return nested;
    }

    return null;
};

export const isUnauthorized = (err: unknown): boolean => getStatus(err) === 401;
export const isForbidden = (err: unknown): boolean => getStatus(err) === 403;
export const isNotFound = (err: unknown): boolean => getStatus(err) === 404;
export const isGone = (err: unknown): boolean => getStatus(err) === 410;
