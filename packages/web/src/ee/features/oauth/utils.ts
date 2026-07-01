import {
    SOURCEBOT_OAUTH_SCOPES,
} from './constants';

const OAUTH_SCOPE_TOKEN_REGEX = /^[\x21\x23-\x5B\x5D-\x7E]+$/;

export function parseOAuthScopeString(scope: string | null | undefined): string[] {
    if (!scope) {
        return [];
    }

    return [...new Set(scope.split(/\s+/).map((token) => token.trim()).filter(Boolean))];
}

export function formatOAuthScopeString(scopes: readonly string[]): string {
    return scopes.join(' ');
}

export function hasRequiredOAuthScopes(tokenScopes: readonly string[], requiredScopes: readonly string[]): boolean {
    const tokenScopeSet = new Set(tokenScopes);
    return requiredScopes.every((scope) => tokenScopeSet.has(scope));
}

export function resolveGrantedOAuthScopes(requestedScope: string | null | undefined): { scopes: string[] } | { error: 'invalid_scope'; errorDescription: string } {
    const requestedScopes = parseOAuthScopeString(requestedScope);

    for (const scope of requestedScopes) {
        if (!OAUTH_SCOPE_TOKEN_REGEX.test(scope)) {
            return {
                error: 'invalid_scope',
                errorDescription: `Invalid OAuth scope token: ${scope}.`,
            };
        }
    }

    const supportedScopeSet = new Set<string>([...SOURCEBOT_OAUTH_SCOPES]);
    for (const scope of requestedScopes) {
        if (!supportedScopeSet.has(scope)) {
            return {
                error: 'invalid_scope',
                errorDescription: `Unsupported OAuth scope: ${scope}.`,
            };
        }
    }

    return {
        scopes: requestedScopes,
    };
}

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
