import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterAccount } from "next-auth/adapters";
import { PrismaClient } from "@sourcebot/db";
import { encryptOAuthToken, env } from "@sourcebot/shared";

/**
 * Encrypts OAuth tokens in account data before database storage
 */
function encryptAccountTokens(account: AdapterAccount): AdapterAccount {
    return {
        ...account,
        access_token: encryptOAuthToken(account.access_token, env.AUTH_SECRET),
        refresh_token: encryptOAuthToken(account.refresh_token, env.AUTH_SECRET),
        id_token: encryptOAuthToken(account.id_token, env.AUTH_SECRET),
    };
}

/**
 * Encrypted Prisma adapter that automatically encrypts OAuth tokens before storage
 */
export function EncryptedPrismaAdapter(prisma: PrismaClient): Adapter {
    const baseAdapter = PrismaAdapter(prisma);
    
    return {
        ...baseAdapter,
        async linkAccount(account: AdapterAccount) {
            return baseAdapter.linkAccount!(encryptAccountTokens(account));
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
    [key: string]: any;
}) {
    return {
        ...data,
        access_token: encryptOAuthToken(data.access_token, env.AUTH_SECRET),
        refresh_token: encryptOAuthToken(data.refresh_token, env.AUTH_SECRET),
        id_token: encryptOAuthToken(data.id_token, env.AUTH_SECRET),
    };
}
