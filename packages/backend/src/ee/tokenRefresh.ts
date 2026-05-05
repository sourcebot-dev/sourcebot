import { Account, PrismaClient } from '@sourcebot/db';
import {
    BitbucketCloudIdentityProviderConfig,
    BitbucketServerIdentityProviderConfig,
    GitHubIdentityProviderConfig,
    GitLabIdentityProviderConfig,
} from '@sourcebot/schemas/v3/index.type';
import {
    createLogger,
    decryptOAuthToken,
    encryptOAuthToken,
    env,
    getTokenFromConfig,
    IdentityProviderType,
    loadConfig,
} from '@sourcebot/shared';
import { z } from 'zod';

const logger = createLogger('backend-ee-token-refresh');

const SUPPORTED_PROVIDERS = [
    'github',
    'gitlab',
    'bitbucket-cloud',
    'bitbucket-server',
] as const satisfies IdentityProviderType[];

type SupportedProviderType = (typeof SUPPORTED_PROVIDERS)[number];

const isSupportedProvider = (providerType: string): providerType is SupportedProviderType =>
    SUPPORTED_PROVIDERS.includes(providerType as SupportedProviderType);

// @see: https://datatracker.ietf.org/doc/html/rfc6749#section-5.1
const OAuthTokenResponseSchema = z.object({
    access_token: z.string(),
    token_type: z.string().optional(),
    expires_in: z.number().optional(),
    refresh_token: z.string().optional(),
    scope: z.string().optional(),
});

type OAuthTokenResponse = z.infer<typeof OAuthTokenResponseSchema>;

type ProviderCredentials = {
    clientId: string;
    clientSecret: string;
    baseUrl?: string;
};

const EXPIRY_BUFFER_S = 5 * 60; // 5 minutes

/**
 * Ensures the OAuth access token for a given account is fresh.
 *
 * - If the token is not expired (or has no expiry), decrypts and returns it as-is.
 * - If the token is expired or near expiry, attempts a refresh using the OAuth
 *   client credentials from the config file (or deprecated env vars).
 * - On successful refresh: persists the new tokens to the DB, clears any
 *   tokenRefreshErrorMessage, and returns the fresh access token.
 * - On failure: sets tokenRefreshErrorMessage on the account and throws, so
 *   the calling job fails with a clear error.
 */
export const ensureFreshAccountToken = async (
    account: Account,
    db: PrismaClient,
): Promise<string> => {
    if (!account.access_token) {
        throw new Error(`Account ${account.id} (${account.providerId}) has no access token.`);
    }

    if (!isSupportedProvider(account.providerType)) {
        // Non-refreshable provider — just decrypt and return whatever is stored.
        const token = decryptOAuthToken(account.access_token);
        if (!token) {
            throw new Error(`Failed to decrypt access token for account ${account.id}.`);
        }
        return token;
    }

    const now = Math.floor(Date.now() / 1000);
    const isExpiredOrNearExpiry =
        account.expires_at !== null &&
        account.expires_at > 0 &&
        now >= account.expires_at - EXPIRY_BUFFER_S;

    if (!isExpiredOrNearExpiry) {
        const token = decryptOAuthToken(account.access_token);
        if (!token) {
            throw new Error(`Failed to decrypt access token for account ${account.id}.`);
        }
        return token;
    }

    if (!account.refresh_token) {
        const message = `Account ${account.id} (${account.providerId}) token is expired and has no refresh token.`;
        logger.error(message);
        await setTokenRefreshError(account.id, message, db);
        throw new Error(message);
    }

    const refreshToken = decryptOAuthToken(account.refresh_token);
    if (!refreshToken) {
        const message = `Failed to decrypt refresh token for account ${account.id} (${account.providerId}).`;
        logger.error(message);
        await setTokenRefreshError(account.id, message, db);
        throw new Error(message);
    }

    logger.debug(`Refreshing OAuth token for account ${account.id} (${account.providerId})...`);

    const refreshResponse = await refreshOAuthToken(
        account.providerId,
        account.providerType,
        refreshToken
    );

    if (!refreshResponse) {
        const message = `OAuth token refresh failed for account ${account.id} (${account.providerId}).`;
        logger.error(message);
        await setTokenRefreshError(account.id, message, db);
        throw new Error(message);
    }

    const newExpiresAt = refreshResponse.expires_in
        ? Math.floor(Date.now() / 1000) + refreshResponse.expires_in
        : null;

    await db.account.update({
        where: { id: account.id },
        data: {
            access_token: encryptOAuthToken(refreshResponse.access_token),
            // Only update refresh_token if a new one was provided; preserve the
            // existing one otherwise (some providers use rotating refresh tokens,
            // others reuse the same one).
            ...(refreshResponse.refresh_token !== undefined
                ? { refresh_token: encryptOAuthToken(refreshResponse.refresh_token) }
                : {}),
            expires_at: newExpiresAt,
            tokenRefreshErrorMessage: null,
        },
    });

    logger.debug(`Successfully refreshed OAuth token for account ${account.id} (${account.providerId}).`);
    return refreshResponse.access_token;
};

const setTokenRefreshError = async (accountId: string, message: string, db: PrismaClient) => {
    await db.account.update({
        where: { id: accountId },
        data: { tokenRefreshErrorMessage: message },
    });
};

const refreshOAuthToken = async (
    providerId: string,
    providerType: SupportedProviderType,
    refreshToken: string,
): Promise<OAuthTokenResponse | null> => {
    try {
        const config = await loadConfig(env.CONFIG_PATH);
        const idpConfig = config.identityProviders ?
                config.identityProviders[providerId] :
                undefined;

        // If no provider configs in the config file, try deprecated env vars.
        if (!idpConfig) {
            const envCredentials = getDeprecatedEnvCredentials(providerType);
            if (envCredentials) {
                logger.debug(`Using deprecated env vars for ${providerType} token refresh`);
                const result = await tryRefreshToken(providerType, refreshToken, envCredentials);
                if (result) {
                    return result;
                }
                logger.error(`Failed to refresh ${providerType} token using deprecated env credentials`);
                return null;
            }
            logger.error(`No provider config or env credentials found for: ${providerType}`);
            return null;
        }

        const linkedAccountProviderConfig = idpConfig as
            GitHubIdentityProviderConfig |
            GitLabIdentityProviderConfig |
            BitbucketCloudIdentityProviderConfig |
            BitbucketServerIdentityProviderConfig;

        // Get client credentials from config
        const clientId = await getTokenFromConfig(linkedAccountProviderConfig.clientId);
        const clientSecret = await getTokenFromConfig(linkedAccountProviderConfig.clientSecret);
        const baseUrl = 'baseUrl' in linkedAccountProviderConfig
            ? linkedAccountProviderConfig.baseUrl
            : undefined;

        const result = await tryRefreshToken(providerType, refreshToken, { clientId, clientSecret, baseUrl });
        if (result) {
            return result;
        }

        logger.error(`Token refresh failed for ${providerId}`);
        return null;
    } catch (e) {
        logger.error(`Error refreshing ${providerType} token:`, e);
        return null;
    }
};

const tryRefreshToken = async (
    providerType: SupportedProviderType,
    refreshToken: string,
    credentials: ProviderCredentials,
): Promise<OAuthTokenResponse | null> => {
    const { clientId, clientSecret, baseUrl } = credentials;

    let url: string;
    if (baseUrl) {
        // Use a trailing-slash-normalized base so relative paths append correctly,
        // preserving any context path (e.g. https://example.com/bitbucket/).
        const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
        if (providerType === 'github') {
            url = new URL('login/oauth/access_token', base).toString();
        } else if (providerType === 'bitbucket-server') {
            url = new URL('rest/oauth2/latest/token', base).toString();
        } else {
            url = new URL('oauth/token', base).toString();
        }
    } else if (providerType === 'github') {
        url = 'https://github.com/login/oauth/access_token';
    } else if (providerType === 'gitlab') {
        url = 'https://gitlab.com/oauth/token';
    } else if (providerType === 'bitbucket-cloud') {
        url = 'https://bitbucket.org/site/oauth2/access_token';
    } else {
        logger.error(`Unsupported provider for token refresh: ${providerType}`);
        return null;
    }

    // Bitbucket requires client credentials via HTTP Basic Auth rather than request body params.
    // @see: https://support.atlassian.com/bitbucket-cloud/docs/use-oauth-on-bitbucket-cloud/
    const useBasicAuth = providerType === 'bitbucket-cloud';

    // Build request body parameters
    const bodyParams: Record<string, string> = {
        // @see: https://datatracker.ietf.org/doc/html/rfc6749#section-6 (refresh token grant)
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
    };

    if (!useBasicAuth) {
        // @see: https://datatracker.ietf.org/doc/html/rfc6749#section-2.3.1 (client authentication)
        bodyParams.client_id = clientId;
        bodyParams.client_secret = clientSecret;
    }

    // GitLab requires redirect_uri to match the original authorization request
    // even when refreshing tokens. Use URL constructor to handle trailing slashes.
    if (providerType === 'gitlab') {
        bodyParams.redirect_uri = new URL('/api/auth/callback/gitlab', env.AUTH_URL).toString();
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            ...(useBasicAuth ? {
                Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            } : {}),
        },
        body: new URLSearchParams(bodyParams),
    });

    if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Failed to refresh ${providerType} token: ${response.status} ${errorText}`);
        return null;
    }

    const json = await response.json();
    const result = OAuthTokenResponseSchema.safeParse(json);

    if (!result.success) {
        logger.error(`Invalid OAuth token response from ${providerType}:\n${result.error.message}`);
        return null;
    }

    return result.data;
}

/**
 * Get credentials from deprecated environment variables.
 * This is for backwards compatibility with deployments using env vars instead of config file.
 */
const getDeprecatedEnvCredentials = (providerType: string): ProviderCredentials | null => {
    if (providerType === 'github' && env.AUTH_EE_GITHUB_CLIENT_ID && env.AUTH_EE_GITHUB_CLIENT_SECRET) {
        return {
            clientId: env.AUTH_EE_GITHUB_CLIENT_ID,
            clientSecret: env.AUTH_EE_GITHUB_CLIENT_SECRET,
            baseUrl: env.AUTH_EE_GITHUB_BASE_URL,
        };
    }
    if (providerType === 'gitlab' && env.AUTH_EE_GITLAB_CLIENT_ID && env.AUTH_EE_GITLAB_CLIENT_SECRET) {
        return {
            clientId: env.AUTH_EE_GITLAB_CLIENT_ID,
            clientSecret: env.AUTH_EE_GITLAB_CLIENT_SECRET,
            baseUrl: env.AUTH_EE_GITLAB_BASE_URL,
        };
    }
    return null;
}