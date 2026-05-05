import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterAccount, AdapterUser } from "next-auth/adapters";
import { PrismaClient } from "@sourcebot/db";
import { encryptOAuthToken, env, loadConfig } from "@sourcebot/shared";

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
 * Resolves the provider type for a given provider id. The id is the
 * unique key in the `identityProviders` config; the type is the inner
 * `provider` field of the matching config entry (github, gitlab, etc.).
 *
 * For deployments still on the deprecated AUTH_EE_*_CLIENT_ID env-var
 * fallback, no entry exists in the normalized config map, but the
 * synthesized id equals the type by construction — so the id itself is a
 * valid type to fall back to.
 */
async function resolveProviderType(providerId: string): Promise<string> {
    const config = await loadConfig(env.CONFIG_PATH);
    const configEntry = config.identityProviders?.[providerId];
    if (configEntry) {
        return configEntry.provider;
    }
    return providerId;
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
            const providerType = await resolveProviderType(account.provider);
            const { provider, ...rest } = encryptAccountTokens(account);
            await prisma.account.create({
                data: {
                    ...rest,
                    providerId: provider,
                    providerType,
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
            // Cast: Prisma's User.email is nullable but AdapterUser.email is
            // typed as `string`. The base PrismaAdapter performs the same
            // implicit widening; we mirror it here.
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
