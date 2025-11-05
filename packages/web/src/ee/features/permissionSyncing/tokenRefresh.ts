import { loadConfig } from "@sourcebot/shared";
import { env } from "@/env.mjs";
import { createLogger } from "@sourcebot/logger";
import { getTokenFromConfig } from '@sourcebot/crypto';
import { GitHubIdentityProviderConfig, GitLabIdentityProviderConfig } from "@sourcebot/schemas/v3/index.type";
import { LinkedAccountTokensMap } from "@/auth"
const { prisma } = await import('@/prisma');

const logger = createLogger('web-ee-token-refresh');

export async function refreshLinkedAccountTokens(
    currentTokens: LinkedAccountTokensMap | undefined
): Promise<LinkedAccountTokensMap> {
    if (!currentTokens) {
        return {};
    }

    const now = Math.floor(Date.now() / 1000);
    const bufferTimeS = 5 * 60; // 5 minutes

    const updatedTokens: LinkedAccountTokensMap = { ...currentTokens };

    await Promise.all(
        Object.entries(currentTokens).map(async ([providerAccountId, tokenData]) => {
            const provider = tokenData.provider;
            if (provider !== 'github' && provider !== 'gitlab') {
                return;
            }

            if (tokenData.expiresAt && now >= (tokenData.expiresAt - bufferTimeS)) {
                try {
                    logger.info(`Refreshing token for providerAccountId: ${providerAccountId} (${tokenData.provider})`);
                    const refreshedTokens = await refreshOAuthToken(
                        provider,
                        tokenData.refreshToken
                    );

                    if (refreshedTokens) {
                        await prisma.account.update({
                            where: {
                                provider_providerAccountId: {
                                    provider: provider,
                                    providerAccountId: providerAccountId
                                }
                            },
                            data: {
                                access_token: refreshedTokens.accessToken,
                                refresh_token: refreshedTokens.refreshToken,
                                expires_at: refreshedTokens.expiresAt,
                            },
                        });

                        updatedTokens[providerAccountId] = {
                            provider: tokenData.provider,
                            accessToken: refreshedTokens.accessToken,
                            refreshToken: refreshedTokens.refreshToken ?? tokenData.refreshToken,
                            expiresAt: refreshedTokens.expiresAt,
                        };
                        logger.info(`Successfully refreshed token for provider: ${provider}`);
                    } else {
                        logger.error(`Failed to refresh token for provider: ${provider}`);
                        updatedTokens[providerAccountId] = {
                            ...tokenData,
                            error: 'RefreshTokenError',
                        };
                    }
                } catch (error) {
                    logger.error(`Error refreshing token for provider ${provider}:`, error);
                    updatedTokens[providerAccountId] = {
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
): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: number } | null> {
    try {
        const config = await loadConfig(env.CONFIG_PATH);
        const identityProviders = config?.identityProviders ?? [];

        const providerConfigs = identityProviders.filter(idp => idp.provider === provider);
        if (providerConfigs.length === 0) {
            logger.error(`Provider config not found or invalid for: ${provider}`);
            return null;
        }

        // Loop through all provider configs and return on first successful fetch
        //
        // The reason we have to do this is because 1) we might have multiple providers of the same type (ex. we're connecting to multiple gitlab instances) and 2) there isn't 
        // a trivial way to map a provider config to the associated Account object in the DB. The reason the config is involved at all here is because we need the client
        // id/secret in order to refresh the token, and that info is in the config. We could in theory bypass this by storing the client id/secret for the provider in the
        // Account table but we decided not to do that since these are secret. Instead, we simply try all of the client/id secrets for the associated provider type. This is safe
        // to do because only the correct client id/secret will work since we're using a specific refresh token.
        for (const providerConfig of providerConfigs) {
            try {
                // Get client credentials from config
                const linkedAccountProviderConfig = providerConfig as GitHubIdentityProviderConfig | GitLabIdentityProviderConfig
                const clientId = await getTokenFromConfig(linkedAccountProviderConfig.clientId);
                const clientSecret = await getTokenFromConfig(linkedAccountProviderConfig.clientSecret);
                const baseUrl = linkedAccountProviderConfig.baseUrl

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
                    continue;
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
                    logger.debug(`Failed to refresh ${provider} token with config: ${response.status} ${errorText}`);
                    continue;
                }

                const data = await response.json();

                const result = {
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token ?? null,
                    expiresAt: data.expires_in ? Math.floor(Date.now() / 1000) + data.expires_in : 0,
                };

                return result;
            } catch (configError) {
                logger.debug(`Error trying provider config for ${provider}:`, configError);
                continue;
            }
        }

        logger.error(`All provider configs failed for: ${provider}`);
        return null;
    } catch (error) {
        logger.error(`Error refreshing ${provider} token:`, error);
        return null;
    }
}
