export const REQUEST_PATH_HEADER = 'x-sourcebot-request-path';

const CALLBACK_URL_ORIGIN = 'https://sourcebot.invalid';

/**
 * Return a same-origin relative URL suitable for use as an auth callback.
 *
 * Callback URLs can come from query parameters, so they must be validated at
 * every boundary where they are consumed. Fragments are intentionally kept
 * out of server-generated callback URLs because browsers do not send them to
 * the server.
 */
export function normalizeCallbackUrl(callbackUrl: unknown): string {
    if (
        typeof callbackUrl !== 'string' ||
        callbackUrl.length === 0 ||
        !callbackUrl.startsWith('/') ||
        callbackUrl.startsWith('//')
    ) {
        return '/';
    }

    try {
        const url = new URL(callbackUrl, CALLBACK_URL_ORIGIN);
        if (url.origin !== CALLBACK_URL_ORIGIN) {
            return '/';
        }

        return `${url.pathname}${url.search}`;
    } catch {
        return '/';
    }
}

export function createLoginUrl(callbackUrl: unknown): string {
    return `/login?callbackUrl=${encodeURIComponent(normalizeCallbackUrl(callbackUrl))}`;
}
