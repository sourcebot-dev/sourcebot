import type { McpServerOAuthScopeEntry } from './types';

export const OAUTH_SCOPE_TOKEN_REGEX = /^[\x21\x23-\x5B\x5D-\x7E]+$/;

// Required for the refresh_token grant that all clients declare. Providers such as
// Atlassian only honour that grant when this scope is included in the authorization request,
// so the admin UI pre-selects it whenever the connector advertises it. Admins can still
// untick it to opt out of refresh tokens.
export const OFFLINE_ACCESS_SCOPE = 'offline_access';

export function normalizeMcpRequestedOAuthScopes(oauthScopes: string[]): string[] {
    return [...new Set(oauthScopes.map((scope) => scope.trim()).filter(Boolean))]
        .sort();
}

export function parseMcpOAuthScopeInput(value: string): string[] {
    return value.split(/[\s,]+/).map((scope) => scope.trim()).filter(Boolean);
}

export function getMcpRequestedOAuthScopes(selectedOAuthScopes: string[], customOAuthScopeInput: string): string[] {
    return normalizeMcpRequestedOAuthScopes([
        ...selectedOAuthScopes,
        ...parseMcpOAuthScopeInput(customOAuthScopeInput),
    ]);
}

export function normalizeMcpOAuthScopeEntries(oauthScopes: McpServerOAuthScopeEntry[]): McpServerOAuthScopeEntry[] {
    const enabledByScope = new Map<string, boolean>();
    for (const entry of oauthScopes) {
        const scope = entry.scope.trim();
        if (!scope) {
            continue;
        }

        enabledByScope.set(scope, (enabledByScope.get(scope) ?? false) || entry.enabled);
    }

    return [...enabledByScope.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([scope, enabled]) => ({ scope, enabled }));
}

export function buildMcpOAuthScopeEntries({
    availableOAuthScopes,
    requestedOAuthScopes,
}: {
    availableOAuthScopes: string[];
    requestedOAuthScopes: string[];
}): McpServerOAuthScopeEntry[] {
    const normalizedRequestedOAuthScopes = normalizeMcpRequestedOAuthScopes(requestedOAuthScopes);
    const requestedScopeSet = new Set(normalizedRequestedOAuthScopes);
    const normalizedAvailableOAuthScopes = normalizeMcpRequestedOAuthScopes([
        ...availableOAuthScopes,
        ...normalizedRequestedOAuthScopes,
    ]);

    return normalizedAvailableOAuthScopes.map((scope) => ({
        scope,
        enabled: requestedScopeSet.has(scope),
    }));
}

export function getEnabledMcpOAuthScopeNames(oauthScopes: McpServerOAuthScopeEntry[]): string[] {
    return normalizeMcpRequestedOAuthScopes(
        oauthScopes.filter((entry) => entry.enabled).map((entry) => entry.scope),
    );
}
