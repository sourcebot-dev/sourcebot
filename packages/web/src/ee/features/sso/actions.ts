'use server';

import { sew } from "@/middleware/sew";
import { OPTIONAL_PROVIDERS_LINK_SKIPPED_COOKIE_NAME } from "@/lib/constants";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { OrgRole, type AccountPermissionSyncIssue } from "@sourcebot/db";
import { hasEntitlement } from "@/lib/entitlements";
import { createLogger, doesIdpSupportPermissionSyncing, env, getIdentityProviderConfigs } from "@sourcebot/shared";
import { cookies } from "next/headers";
import { removeAccountPermissionSyncScheduler, scheduleAndTriggerAccountPermissionSync } from "@/ee/features/permissionSync/accountPermissionSyncQueue.server";
import { unexpectedError } from "@/lib/serviceError";

const logger = createLogger('web-ee-sso-actions');

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

export const getLinkedAccounts = async () => sew(() =>
    withAuth(async ({ prisma, role, user }) =>
        withMinimumOrgRole(role, OrgRole.MEMBER, async () => {
            const accounts = await prisma.account.findMany({
                where: { userId: user.id },
                select: {
                    id: true,
                    providerType: true,
                    providerId: true,
                    providerAccountId: true,
                    permissionSyncIssue: true,
                },
            });

            const permissionSyncEnabled =
                env.PERMISSION_SYNC_ENABLED === 'true' &&
                await hasEntitlement('permission-syncing');

            // getIdentityProviderConfig re-invokes getIdentityProviderConfigs
            // (and therefore loadConfig) on every call, so calling it inside the
            // loop below would re-read the config file once per linked account.
            // Hoist the lookup to a single call before the loop, mirroring the
            // pattern already used by the second loop in this function.
            const identityProviders = await getIdentityProviderConfigs();

            const result: LinkedAccount[] = [];

            // All connected accounts (from DB), enriched with config data where available
            for (const account of accounts) {
                const providerConfig = identityProviders[account.providerId];
                const isAccountLinking = providerConfig?.purpose === 'account_linking';

                result.push({
                    providerId: account.providerId,
                    providerType: account.providerType,
                    displayName: providerConfig?.displayName,
                    isLinked: true,
                    accountId: account.id,
                    providerAccountId: account.providerAccountId,
                    permissionSyncIssue: account.permissionSyncIssue ?? undefined,
                    isAccountLinkingProvider: isAccountLinking,
                    required: isAccountLinking ? (providerConfig?.accountLinkingRequired ?? false) : false,
                    supportsPermissionSync: permissionSyncEnabled && doesIdpSupportPermissionSyncing(account.providerType),
                });
            }

            // Unlinked account_linking providers from config (not yet connected).
            // Reuses the `identityProviders` map loaded once above.
            for (const [id, providerConfig] of Object.entries(identityProviders)) {
                const account = accounts.find((account) => account.providerId === id);
                if (!account) {
                    result.push({
                        providerId: id,
                        providerType: providerConfig.provider,
                        displayName: providerConfig.displayName,
                        isLinked: false,
                        isAccountLinkingProvider: providerConfig.purpose === 'account_linking',
                        required: providerConfig.purpose === 'account_linking' ? (providerConfig.accountLinkingRequired ?? false) : false,
                        supportsPermissionSync: permissionSyncEnabled && doesIdpSupportPermissionSyncing(providerConfig.provider),
                    });
                }
            }

            return result;
        })
    )
);

export const triggerAccountPermissionSync = async (accountId: string) => sew(() =>
    withAuth(({ prisma, role, user }) =>
        withMinimumOrgRole(role, OrgRole.MEMBER, async () => {
            try {
                if (
                    env.PERMISSION_SYNC_ENABLED !== 'true' ||
                    !await hasEntitlement('permission-syncing')
                ) {
                    return unexpectedError('Permission syncing is not enabled');
                }

                const account = await prisma.account.findFirst({
                    where: {
                        id: accountId,
                        userId: user.id,
                    },
                    select: {
                        providerType: true,
                    },
                });
                if (
                    !account ||
                    !doesIdpSupportPermissionSyncing(account.providerType)
                ) {
                    return unexpectedError('Account does not support permission syncing');
                }

                return await scheduleAndTriggerAccountPermissionSync(accountId);
            } catch {
                return unexpectedError('Failed to trigger account permission sync');
            }
        })
    )
);

export const unlinkLinkedAccountProvider = async (providerId: string) => sew(() =>
    withAuth(async ({ prisma, role, user }) =>
        withMinimumOrgRole(role, OrgRole.MEMBER, async () => {
            const where = {
                providerId,
                userId: user.id,
            };
            const accounts = await prisma.account.findMany({
                where,
                select: {
                    id: true,
                },
            });

            await Promise.all(
                accounts.map(({ id }) =>
                    removeAccountPermissionSyncScheduler(id),
                ),
            );

            const result = await prisma.account.deleteMany({
                where,
            });

            logger.info(`Unlinked account provider ${providerId} for user ${user.id}. Deleted ${result.count} account(s).`);

            return { success: true, count: result.count };
        })
    )
);

// eslint-disable-next-line authz/require-auth-wrapper -- UI-only preference cookie, no DB access
export const skipOptionalProvidersLink = async () => sew(async () => {
    const cookieStore = await cookies();
    cookieStore.set(OPTIONAL_PROVIDERS_LINK_SKIPPED_COOKIE_NAME, 'true', {
        httpOnly: false, // Allow client-side access
        maxAge: 365 * 24 * 60 * 60, // 1 year in seconds
    });
    return true;
});
