import { env, hasEntitlement } from "@sourcebot/shared";

/**
 * Normalize scope strings for consistent comparison.
 * Handles different delimiters and ordering.
 */
export function normalizeScopes(scopeString: string | null | undefined): string {
    if (!scopeString) return '';
    return scopeString.split(/[\s,]+/).filter(Boolean).sort().join(' ');
}

/**
 * Calculate the required OAuth scopes for a given provider based on current configuration.
 * Returns a normalized, sorted scope string.
 */
export function getRequiredScopes(provider: string): string {
    const scopes: string[] = [];

    switch (provider) {
        case 'github':
            scopes.push('read:user', 'user:email');
            // Permission syncing requires the `repo` scope in order to fetch repositories
            // for the authenticated user.
            // @see: https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#list-repositories-for-the-authenticated-user
            if (env.EXPERIMENT_EE_PERMISSION_SYNC_ENABLED === 'true' && hasEntitlement('permission-syncing')) {
                scopes.push('repo');
            }

            break;

        case 'gitlab':
            scopes.push('read_user');
            // Permission syncing requires the `read_api` scope in order to fetch projects
            // for the authenticated user and project members.
            // @see: https://docs.gitlab.com/ee/api/projects.html#list-all-projects
            if (env.EXPERIMENT_EE_PERMISSION_SYNC_ENABLED === 'true' && hasEntitlement('permission-syncing')) {
                scopes.push('read_api');
            }
            break;

        default:
            // Other providers (Google, Okta, etc.) don't have dynamic scope requirements
            return '';
    }

    return normalizeScopes(scopes.join(' '));
}

