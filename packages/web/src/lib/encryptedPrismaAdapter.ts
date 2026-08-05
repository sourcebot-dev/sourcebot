import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterAccount, AdapterUser } from "next-auth/adapters";
import { PrismaClient } from "@sourcebot/db";
import { encryptOAuthToken, getIdentityProviderConfig } from "@sourcebot/shared";

/**
 * Encrypts OAuth tokens in account data before database storage
 */
function encryptAccountTokens(account: AdapterAccount): AdapterAccount {
    return {
        ...account,
        access_token: encryptOAuthToken(account.access_token),
        refresh_token: encryptOAuthToken(account.refresh_token),
        id_token: encryptOAuthToken(account.id_token),
    };
}

/**
 * Encrypted Prisma adapter that:
 * 1. Encrypts OAuth tokens in account data before persisting them.
 * 2. Remaps the auth.js `provider` field onto our `providerId` /
 *    `providerType` columns so the same provider type (e.g., github)
 *    can be configured as multiple distinct instances.
 */
export function EncryptedPrismaAdapter(prisma: PrismaClient): Adapter {
    const baseAdapter = PrismaAdapter(prisma);

    return {
        ...baseAdapter,
        async linkAccount(account: AdapterAccount) {
            const idpConfig = await getIdentityProviderConfig(account.provider);
            if (!idpConfig) {
                throw new Error(`Failed to link account for user id ${account.userId}. No provider config found for account with type ${account.provider}`);
            }

            const { provider, ...rest } = encryptAccountTokens(account);
            await prisma.account.create({
                data: {
                    ...rest,
                    providerId: provider,
                    providerType: idpConfig.provider,
                },
            });
            return account;
        },
        async getUserByAccount({ provider, providerAccountId }) {
            const account = await prisma.account.findUnique({
                where: {
                    providerId_providerAccountId: {
                        providerId: provider,
                        providerAccountId,
                    },
                },
                include: { user: true },
            });
            // Cast to AdapterUser to satisfy next-auth's adapter return type;
            // the base PrismaAdapter returns the user row directly, and we mirror it.
            return (account?.user ?? null) as AdapterUser | null;
        },
        async unlinkAccount({ provider, providerAccountId }) {
            await prisma.account.delete({
                where: {
                    providerId_providerAccountId: {
                        providerId: provider,
                        providerAccountId,
                    },
                },
            });
        },
    };
}

/**
 * Encrypts OAuth tokens in account data (for manual account updates in signIn event)
 */
export function encryptAccountData(data: {
    access_token?: string | null;
    refresh_token?: string | null;
    id_token?: string | null;
    expires_at?: number | null;
    token_type?: string | null;
    scope?: string | null;
    issuerUrl?: string | null;
    tokenRefreshErrorMessage?: string | null;
}) {
    return {
        ...data,
        access_token: encryptOAuthToken(data.access_token),
        refresh_token: encryptOAuthToken(data.refresh_token),
        id_token: encryptOAuthToken(data.id_token),
    };
}
