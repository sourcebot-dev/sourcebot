import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterAccount } from "next-auth/adapters";
import { PrismaClient } from "@sourcebot/db";
import { encryptOAuthToken } from "@sourcebot/shared";

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
 * Encrypted Prisma adapter that automatically encrypts OAuth tokens before storage
 */
export function EncryptedPrismaAdapter(prisma: PrismaClient): Adapter {
    const baseAdapter = PrismaAdapter(prisma);
    
    return {
        ...baseAdapter,
        linkAccount(account: AdapterAccount) {
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
    expires_at?: number | null;
    token_type?: string | null;
    scope?: string | null;
}) {
    return {
        ...data,
        access_token: encryptOAuthToken(data.access_token),
        refresh_token: encryptOAuthToken(data.refresh_token),
        id_token: encryptOAuthToken(data.id_token),
    };
}
