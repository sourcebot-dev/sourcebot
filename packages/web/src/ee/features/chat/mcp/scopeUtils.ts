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
