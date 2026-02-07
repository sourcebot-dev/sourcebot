import { loadConfig, decryptOAuthToken } from "@sourcebot/shared";
import { getTokenFromConfig, createLogger, env, encryptOAuthToken } from "@sourcebot/shared";
import { GitHubIdentityProviderConfig, GitLabIdentityProviderConfig } from "@sourcebot/schemas/v3/index.type";
import { z } from 'zod';
import { prisma } from '@/prisma';

const logger = createLogger('web-ee-token-refresh');

// Map of providerAccountId -> error message
export type LinkedAccountErrors = Record<string, string>;

// In-memory lock to prevent concurrent refresh attempts for the same user
const refreshLocks = new Map<string, Promise<LinkedAccountErrors>>();

/**
 * Refreshes expiring OAuth tokens for all linked accounts of a user.
 * Loads accounts from database, refreshes tokens as needed, and returns any errors.
 * Uses an in-memory lock to prevent concurrent refresh attempts for the same user.
 */
export const refreshLinkedAccountTokens = async (userId: string): Promise<LinkedAccountErrors> => {
    // Check if there's already an in-flight refresh for this user
    const existingRefresh = refreshLocks.get(userId);
    if (existingRefresh) {
        return existingRefresh;
    }

    // Create the refresh promise and store it in the lock map
    const refreshPromise = doRefreshLinkedAccountTokens(userId);
    refreshLocks.set(userId, refreshPromise);

    try {
        return await refreshPromise;
    } finally {
        refreshLocks.delete(userId);
    }
};

const doRefreshLinkedAccountTokens = async (userId: string): Promise<LinkedAccountErrors> => {
    const accounts = await prisma.account.findMany({
        where: {
            userId,
            access_token: { not: null },
            refresh_token: { not: null },
            expires_at: { not: null },
        },
        select: {
            provider: true,
            providerAccountId: true,
            access_token: true,
            refresh_token: true,
            expires_at: true,
        },
    });

    const now = Math.floor(Date.now() / 1000);
    const bufferTimeS = 5 * 60; // 5 minutes
    const errors: LinkedAccountErrors = {};

    await Promise.all(
        accounts.map(async (account) => {
            const { provider, providerAccountId, expires_at } = account;

            if (provider !== 'github' && provider !== 'gitlab') {
                return;
            }

            if (expires_at !== null && expires_at > 0 && now >= (expires_at - bufferTimeS)) {
                const refreshToken = decryptOAuthToken(account.refresh_token);
                if (!refreshToken) {
                    logger.error(`Failed to decrypt refresh token for providerAccountId: ${providerAccountId}`);
                    errors[providerAccountId] = 'RefreshTokenError';
                    return;
                }

                try {
                    logger.info(`Refreshing token for providerAccountId: ${providerAccountId} (${provider})`);
                    const refreshTokenResponse = await refreshOAuthToken(provider, refreshToken);

                    if (refreshTokenResponse) {
                        const expires_at = refreshTokenResponse.expires_in ? Math.floor(Date.now() / 1000) + refreshTokenResponse.expires_in : null;

                        await prisma.account.update({
                            where: {
                                provider_providerAccountId: {
                                    provider,
                                    providerAccountId,
                                }
                            },
                            data: {
                                access_token: encryptOAuthToken(refreshTokenResponse.access_token),
                                refresh_token: encryptOAuthToken(refreshTokenResponse.refresh_token),
                                expires_at,
                            },
                        });
                        logger.info(`Successfully refreshed token for provider: ${provider}`);
                    } else {
                        logger.error(`Failed to refresh token for provider: ${provider}`);
                        errors[providerAccountId] = 'RefreshTokenError';
                    }
                } catch (error) {
                    logger.error(`Error refreshing token for provider ${provider}:`, error);
                    errors[providerAccountId] = 'RefreshTokenError';
                }
            }
        })
    );

    return errors;
}

const refreshOAuthToken = async (
    provider: string,
    refreshToken: string,
): Promise<OAuthTokenResponse | null> => {
    try {
        const config = await loadConfig(env.CONFIG_PATH);
        const identityProviders = config?.identityProviders ?? [];

        const providerConfigs = identityProviders.filter(idp => idp.provider === provider);

        // If no provider configs in the config file, try deprecated env vars
        if (providerConfigs.length === 0) {
            const envCredentials = getDeprecatedEnvCredentials(provider);
            if (envCredentials) {
                logger.debug(`Using deprecated env vars for ${provider} token refresh`);
                const result = await tryRefreshToken(provider, refreshToken, envCredentials);
                if (result) {
                    return result;
                }
            }
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
                const baseUrl = linkedAccountProviderConfig.baseUrl;

                const result = await tryRefreshToken(provider, refreshToken, { clientId, clientSecret, baseUrl });
                if (result) {
                    return result;
                }
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

type ProviderCredentials = {
    clientId: string;
    clientSecret: string;
    baseUrl?: string;
};

// @see: https://datatracker.ietf.org/doc/html/rfc6749#section-5.1
const OAuthTokenResponseSchema = z.object({
    access_token: z.string(),
    token_type: z.string().optional(),
    expires_in: z.number().optional(),
    refresh_token: z.string().optional(),
    scope: z.string().optional(),
});

type OAuthTokenResponse = z.infer<typeof OAuthTokenResponseSchema>;

const tryRefreshToken = async (
    provider: string,
    refreshToken: string,
    credentials: ProviderCredentials,
): Promise<OAuthTokenResponse | null> => {
    const { clientId, clientSecret, baseUrl } = credentials;

    let url: string;
    if (baseUrl) {
        url = provider === 'github'
            ? new URL('/login/oauth/access_token', baseUrl).toString()
            : new URL('/oauth/token', baseUrl).toString();
    } else if (provider === 'github') {
        url = 'https://github.com/login/oauth/access_token';
    } else if (provider === 'gitlab') {
        url = 'https://gitlab.com/oauth/token';
    } else {
        logger.error(`Unsupported provider for token refresh: ${provider}`);
        return null;
    }

    // Build request body parameters
    const bodyParams: Record<string, string> = {
        // @see: https://datatracker.ietf.org/doc/html/rfc6749#section-2.3.1 (client authentication)
        client_id: clientId,
        client_secret: clientSecret,

        // @see: https://datatracker.ietf.org/doc/html/rfc6749#section-6 (refresh token grant)
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
    };

    // GitLab requires redirect_uri to match the original authorization request
    // even when refreshing tokens. Use URL constructor to handle trailing slashes.
    if (provider === 'gitlab') {
        bodyParams.redirect_uri = new URL('/api/auth/callback/gitlab', env.AUTH_URL).toString();
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
        },
        body: new URLSearchParams(bodyParams),
    });

    if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Failed to refresh ${provider} token: ${response.status} ${errorText}`);
        return null;
    }

    const json = await response.json();
    const result = OAuthTokenResponseSchema.safeParse(json);

    if (!result.success) {
        logger.error(`Invalid OAuth token response from ${provider}:\n${JSON.stringify(json, null, 2)}`);
        return null;
    }

    return result.data;
}

/**
 * Get credentials from deprecated environment variables.
 * This is for backwards compatibility with deployments using env vars instead of config file.
 */
const getDeprecatedEnvCredentials = (provider: string): ProviderCredentials | null => {
    if (provider === 'github' && env.AUTH_EE_GITHUB_CLIENT_ID && env.AUTH_EE_GITHUB_CLIENT_SECRET) {
        return {
            clientId: env.AUTH_EE_GITHUB_CLIENT_ID,
            clientSecret: env.AUTH_EE_GITHUB_CLIENT_SECRET,
            baseUrl: env.AUTH_EE_GITHUB_BASE_URL,
        };
    }
    if (provider === 'gitlab' && env.AUTH_EE_GITLAB_CLIENT_ID && env.AUTH_EE_GITLAB_CLIENT_SECRET) {
        return {
            clientId: env.AUTH_EE_GITLAB_CLIENT_ID,
            clientSecret: env.AUTH_EE_GITLAB_CLIENT_SECRET,
            baseUrl: env.AUTH_EE_GITLAB_BASE_URL,
        };
    }
    return null;
}