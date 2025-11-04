import { loadConfig } from "@sourcebot/shared";
import { env } from "@/env.mjs";
import { createLogger } from "@sourcebot/logger";
import { getTokenFromConfig } from '@sourcebot/crypto';
import { GitHubIdentityProviderConfig, GitLabIdentityProviderConfig } from "@sourcebot/schemas/v3/index.type";

const logger = createLogger('web-ee-token-refresh');

export type IntegrationToken = {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    error?: string;
};

export type IntegrationTokensMap = Record<string, IntegrationToken>;

export async function refreshIntegrationTokens(
    currentTokens: IntegrationTokensMap | undefined,
    userId: string
): Promise<IntegrationTokensMap> {
    if (!currentTokens) {
        return {};
    }

    const now = Math.floor(Date.now() / 1000);
    const bufferTimeS = 5 * 60; // 5 minutes

    const updatedTokens: IntegrationTokensMap = { ...currentTokens };

    // Refresh tokens for each integration provider
    await Promise.all(
        Object.entries(currentTokens).map(async ([provider, tokenData]) => {
            if (provider !== 'github' && provider !== 'gitlab') {
                return;
            }

            if (tokenData.expiresAt && now >= (tokenData.expiresAt - bufferTimeS)) {
                try {
                    logger.info(`Refreshing token for provider: ${provider}`);
                    const refreshedTokens = await refreshOAuthToken(
                        provider,
                        tokenData.refreshToken,
                        userId
                    );

                    if (refreshedTokens) {
                        updatedTokens[provider] = {
                            accessToken: refreshedTokens.accessToken,
                            refreshToken: refreshedTokens.refreshToken ?? tokenData.refreshToken,
                            expiresAt: refreshedTokens.expiresAt,
                        };
                        logger.info(`Successfully refreshed token for provider: ${provider}`);
                    } else {
                        logger.error(`Failed to refresh token for provider: ${provider}`);
                        updatedTokens[provider] = {
                            ...tokenData,
                            error: 'RefreshTokenError',
                        };
                    }
                } catch (error) {
                    logger.error(`Error refreshing token for provider ${provider}:`, error);
                    updatedTokens[provider] = {
                        ...tokenData,
                        error: 'RefreshTokenError',
                    };
                }
            }
        })
    );

    return updatedTokens;
}

export async function refreshOAuthToken(
    provider: string,
    refreshToken: string,
    userId: string
): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: number } | null> {
    try {
        const config = await loadConfig(env.CONFIG_PATH);
        const identityProviders = config?.identityProviders ?? [];

        const providerConfig = identityProviders.find(idp => idp.provider === provider);
        if (!providerConfig) {
            logger.error(`Provider config not found or invalid for: ${provider}`);
            return null;
        }

        // Get client credentials from config
        const integrationProviderConfig = providerConfig as GitHubIdentityProviderConfig | GitLabIdentityProviderConfig
        const clientId = await getTokenFromConfig(integrationProviderConfig.clientId);
        const clientSecret = await getTokenFromConfig(integrationProviderConfig.clientSecret);
        const baseUrl = 'baseUrl' in integrationProviderConfig && integrationProviderConfig.baseUrl
            ? await getTokenFromConfig(integrationProviderConfig.baseUrl)
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
}
