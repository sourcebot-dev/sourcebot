'use server';

import { sew } from "@/middleware/sew";
import { OPTIONAL_PROVIDERS_LINK_SKIPPED_COOKIE_NAME } from "@/lib/constants";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { OrgRole } from "@sourcebot/db";
import { createLogger, env, IdentityProviderType, loadConfig, PERMISSION_SYNC_SUPPORTED_IDENTITY_PROVIDERS } from "@sourcebot/shared";
import { hasEntitlement } from "@/lib/entitlements";
import { cookies } from "next/headers";

const logger = createLogger('web-ee-sso-actions');

export type LinkedAccount = {
    provider: string;
    isLinked: boolean;
    // Present when isLinked = true
    accountId?: string;
    providerAccountId?: string;
    error?: string;
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
                    provider: true,
                    providerAccountId: true,
                    tokenRefreshErrorMessage: true,
                },
            });

            const config = await loadConfig(env.CONFIG_PATH);
            const identityProviderConfigs = config.identityProviders ?? [];

            const permissionSyncEnabled =
                env.PERMISSION_SYNC_ENABLED === 'true' &&
                await hasEntitlement('permission-syncing');

            const accountsByProvider = new Map(accounts.map(a => [a.provider, a]));
            const result: LinkedAccount[] = [];

            // All connected accounts (from DB), enriched with config data where available
            for (const account of accounts) {
                const providerConfig = identityProviderConfigs.find(c => c.provider === account.provider);
                const isAccountLinking = providerConfig?.purpose === 'account_linking';

                result.push({
                    provider: account.provider,
                    isLinked: true,
                    accountId: account.id,
                    providerAccountId: account.providerAccountId,
                    error: account.tokenRefreshErrorMessage ?? undefined,
                    isAccountLinkingProvider: isAccountLinking,
                    required: isAccountLinking ? (providerConfig?.accountLinkingRequired ?? false) : false,
                    supportsPermissionSync: permissionSyncEnabled && PERMISSION_SYNC_SUPPORTED_IDENTITY_PROVIDERS.includes(account.provider as IdentityProviderType),
                });
            }

            // Unlinked account_linking providers from config (not yet connected)
            for (const providerConfig of identityProviderConfigs) {
                if (!accountsByProvider.has(providerConfig.provider)) {
                    result.push({
                        provider: providerConfig.provider,
                        isLinked: false,
                        isAccountLinkingProvider: providerConfig.purpose === 'account_linking',
                        required: providerConfig.purpose === 'account_linking' ? (providerConfig.accountLinkingRequired ?? false) : false,
                        supportsPermissionSync: permissionSyncEnabled && PERMISSION_SYNC_SUPPORTED_IDENTITY_PROVIDERS.includes(providerConfig.provider),
                    });
                }
            }

            return result;
        })
    )
);


export const unlinkLinkedAccountProvider = async (provider: string) => sew(() =>
    withAuth(async ({ prisma, role, user }) =>
        withMinimumOrgRole(role, OrgRole.MEMBER, async () => {
            const result = await prisma.account.deleteMany({
                where: {
                    provider,
                    userId: user.id,
                },
            });

            logger.info(`Unlinked account provider ${provider} for user ${user.id}. Deleted ${result.count} account(s).`);

            return { success: true, count: result.count };
        })
    )
);

export const skipOptionalProvidersLink = async () => sew(async () => {
    const cookieStore = await cookies();
    cookieStore.set(OPTIONAL_PROVIDERS_LINK_SKIPPED_COOKIE_NAME, 'true', {
        httpOnly: false, // Allow client-side access
        maxAge: 365 * 24 * 60 * 60, // 1 year in seconds
    });
    return true;
});

