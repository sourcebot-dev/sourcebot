'use server';

import { sew } from "@/actions";
import { createLogger } from "@sourcebot/logger";
import { withAuthV2, withMinimumOrgRole } from "@/withAuthV2";
import { loadConfig } from "@sourcebot/shared";
import { env } from "@/env.mjs";
import { OrgRole } from "@sourcebot/db";
import { cookies } from "next/headers";
import { OPTIONAL_PROVIDERS_LINK_SKIPPED_COOKIE_NAME } from "@/lib/constants";
import { getTokenFromConfig } from '@sourcebot/crypto';
import { IntegrationIdentityProviderState } from "@/ee/features/permissionSyncing/types";
import { GitHubIdentityProviderConfig, GitLabIdentityProviderConfig } from "@sourcebot/schemas/v3/index.type";

const logger = createLogger('web-ee-permission-syncing-actions');

export const getIntegrationProviderStates = async () => sew(() =>
    withAuthV2(async ({ prisma, role, user }) =>
        withMinimumOrgRole(role, OrgRole.MEMBER, async () => {
            const config = await loadConfig(env.CONFIG_PATH);
            const integrationProviderConfigs = config.identityProviders ?? [];
            const linkedAccounts = await prisma.account.findMany({
                where: {
                    userId: user.id,
                    provider: {
                        in: integrationProviderConfigs.map(p => p.provider)
                    }
                },
                select: {
                    provider: true,
                    providerAccountId: true
                }
            });

            const integrationProviderState: IntegrationIdentityProviderState[] = [];
            for (const integrationProviderConfig of integrationProviderConfigs) {
                if (integrationProviderConfig.purpose === "integration") {
                    const linkedAccount = linkedAccounts.find(
                        account => account.provider === integrationProviderConfig.provider
                    );

                    const isLinked = !!linkedAccount;
                    const isRequired = integrationProviderConfig.required ?? true;
                    integrationProviderState.push({
                        id: integrationProviderConfig.provider,
                        required: isRequired,
                        isLinked,
                        linkedAccountId: linkedAccount?.providerAccountId
                    } as IntegrationIdentityProviderState);
                }
            }

            return integrationProviderState;
        })
    )
);


export const unlinkIntegrationProvider = async (provider: string) => sew(() =>
    withAuthV2(async ({ prisma, role, user }) =>
        withMinimumOrgRole(role, OrgRole.MEMBER, async () => {
            const config = await loadConfig(env.CONFIG_PATH);
            const identityProviders = config.identityProviders ?? [];

            const providerConfig = identityProviders.find(idp => idp.provider === provider)
            if (!providerConfig || !('purpose' in providerConfig) || providerConfig.purpose !== "integration") {
                throw new Error("Provider is not an integration provider");
            }

            // Delete the account
            const result = await prisma.account.deleteMany({
                where: {
                    provider,
                    userId: user.id,
                },
            });

            logger.info(`Unlinked integration provider ${provider} for user ${user.id}. Deleted ${result.count} account(s).`);

            // If we're unlinking a required identity provider then we want to wipe the optional skip cookie if it exists so that we give the
            // user the option of linking optional providers in the same link accounts screen
            const isRequired = providerConfig.required ?? true;
            if (isRequired) {
                const cookieStore = await cookies();
                cookieStore.delete(OPTIONAL_PROVIDERS_LINK_SKIPPED_COOKIE_NAME);
            }

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

export const refreshOAuthToken = async (
    provider: string,
    refreshToken: string,
    userId: string
): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: number } | null> => {
    try {
        // Load config and find the provider configuration
        const config = await loadConfig(env.CONFIG_PATH);
        const identityProviders = config?.identityProviders ?? [];
        
        const providerConfig = identityProviders.find(
            idp => idp.provider === provider
        ) as GitHubIdentityProviderConfig | GitLabIdentityProviderConfig;

        if (!providerConfig || !('clientId' in providerConfig) || !('clientSecret' in providerConfig)) {
            logger.error(`Provider config not found or invalid for: ${provider}`);
            return null;
        }

        // Get client credentials from config
        const clientId = await getTokenFromConfig(providerConfig.clientId);
        const clientSecret = await getTokenFromConfig(providerConfig.clientSecret);
        const baseUrl = 'baseUrl' in providerConfig && providerConfig.baseUrl 
            ? await getTokenFromConfig(providerConfig.baseUrl) 
            : undefined;

        let url: string;
        if (baseUrl) {
            url = provider === 'github' 
                ? `${baseUrl}/login/oauth/access_token`
                : `${baseUrl}/oauth/token`;
        } else if (provider === 'github') {
            url = 'https://github.com/login/oauth/access_token';
        } else if (provider === 'gitlab') {
            url = 'https://gitlab.com/oauth/token';
        } else {
            logger.error(`Unsupported provider for token refresh: ${provider}`);
            return null;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error(`Failed to refresh ${provider} token: ${response.status} ${errorText}`);
            return null;
        }

        const data = await response.json();

        const result = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token ?? null,
            expiresAt: data.expires_in ? Math.floor(Date.now() / 1000) + data.expires_in : 0,
        };

        const { prisma } = await import('@/prisma');
        await prisma.account.updateMany({
            where: {
                userId: userId,
                provider: provider,
            },
            data: {
                access_token: result.accessToken,
                refresh_token: result.refreshToken,
                expires_at: result.expiresAt,
            },
        });

        return result;
    } catch (error) {
        logger.error(`Error refreshing ${provider} token:`, error);
        return null;
    }
};