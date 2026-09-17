import type { AccountPermissionSyncIssue } from "@sourcebot/db";

export type LinkedAccount = {
    /** Provider instance id (e.g., 'github', 'gitlab-corp') — used for `signIn(provider)`. */
    providerId: string;
    /** Provider type (e.g., 'github', 'gitlab') — used to pick icon / display defaults. */
    providerType: string;
    /** Optional admin-supplied display name from config; overrides type-derived defaults in the UI. */
    displayName?: string;
    isLinked: boolean;
    // Present when isLinked = true
    accountId?: string;
    providerAccountId?: string;
    permissionSyncIssue?: AccountPermissionSyncIssue;
    // From config (only meaningful for account_linking providers)
    isAccountLinkingProvider: boolean;
    required: boolean;
    // Permission sync
    supportsPermissionSync: boolean;
};
