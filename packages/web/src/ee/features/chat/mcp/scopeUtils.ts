import type { McpServerScopeEntry } from './types';

export const OAUTH_SCOPE_TOKEN_REGEX = /^[\x21\x23-\x5B\x5D-\x7E]+$/;

export function normalizeMcpRequestedScopes(scopes: string[]): string[] {
    return [...new Set(scopes.map((scope) => scope.trim()).filter(Boolean))]
        .sort();
}

export function parseMcpScopeInput(value: string): string[] {
    return value.split(/[\s,]+/).map((scope) => scope.trim()).filter(Boolean);
}

export function getMcpRequestedScopes(selectedScopes: string[], customScopeInput: string): string[] {
    return normalizeMcpRequestedScopes([
        ...selectedScopes,
        ...parseMcpScopeInput(customScopeInput),
    ]);
}

export function normalizeMcpScopeEntries(scopes: McpServerScopeEntry[]): McpServerScopeEntry[] {
    const enabledByScope = new Map<string, boolean>();
    for (const entry of scopes) {
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

export function buildMcpScopeEntries({
    availableScopes,
    requestedScopes,
}: {
    availableScopes: string[];
    requestedScopes: string[];
}): McpServerScopeEntry[] {
    const normalizedRequestedScopes = normalizeMcpRequestedScopes(requestedScopes);
    const requestedScopeSet = new Set(normalizedRequestedScopes);
    const normalizedAvailableScopes = normalizeMcpRequestedScopes([
        ...availableScopes,
        ...normalizedRequestedScopes,
    ]);

    return normalizedAvailableScopes.map((scope) => ({
        scope,
        enabled: requestedScopeSet.has(scope),
    }));
}

export function getEnabledMcpScopeNames(scopes: McpServerScopeEntry[]): string[] {
    return normalizeMcpRequestedScopes(
        scopes.filter((entry) => entry.enabled).map((entry) => entry.scope),
    );
}
