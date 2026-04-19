
export const OAUTH_NOT_SUPPORTED_ERROR_MESSAGE = 'OAuth is not supported on this instance. Please authenticate using a Sourcebot API key instead. See https://docs.sourcebot.dev/docs/features/mcp-server for more information.';

export const UNPERMITTED_SCHEMES = /^(javascript|data|vbscript):/i;

/**
 * Returns true if the URL is permitted for use as a redirect target.
 * Allows relative paths starting with /oauth/complete and http(s) URLs.
 * Returns false for dangerous schemes like javascript:, data:, vbscript:.
 */
export function isPermittedRedirectUrl(url: string): boolean {
    if (url.startsWith('/oauth/complete')) {
        return true;
    }

    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}