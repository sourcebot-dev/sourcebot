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
    getIdentityProviderConfig,
    getTokenFromConfig,
    IdentityProviderType,
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

// @see: https://datatracker.ietf.org/doc/html/rfc6749#section-5.2
const OAuthErrorResponseSchema = z.object({
    error: z.string(),
    error_description: z.string().optional(),
});
type OAuthTokenResponse = z.infer<typeof OAuthTokenResponseSchema>;
type OAuthErrorResponse = z.infer<typeof OAuthErrorResponseSchema>;

export type TokenRefreshErrorKind =
    | 'refresh_token_rejected'
    | 'transient'
    | 'configuration'
    | 'invalid_response'
    | 'local_credential';

type TokenRefreshErrorOptions = {
    kind: TokenRefreshErrorKind;
    status?: number;
    oauthError?: string;
    errorDescription?: string;
    cause?: unknown;
};

export class TokenRefreshError extends Error {
    public readonly kind: TokenRefreshErrorKind;
    public readonly status?: number;
    public readonly oauthError?: string;
    public readonly errorDescription?: string;

    constructor(message: string, options: TokenRefreshErrorOptions) {
        super(message, { cause: options.cause });
        this.name = 'TokenRefreshError';
        this.kind = options.kind;
        this.status = options.status;
        this.oauthError = options.oauthError;
        this.errorDescription = options.errorDescription;
    }

    public get isRetryable(): boolean {
        return this.kind === 'transient';
    }
}

type ProviderCredentials = {
    clientId: string;
    clientSecret: string;
    baseUrl?: string;
};

const EXPIRY_BUFFER_S = 5 * 60; // 5 minutes
const TOKEN_REFRESH_TIMEOUT_MS = 15 * 1000;
const TOKEN_REFRESH_MAX_ATTEMPTS = 3;
const TOKEN_REFRESH_RETRY_BASE_DELAY_MS = 3 * 1000;

const getErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

const wait = async (delayMs: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, delayMs));

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
        throw new TokenRefreshError(
            `Account ${account.id} (${account.providerId}) has no access token.`,
            { kind: 'local_credential' },
        );
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
        throw new TokenRefreshError(message, { kind: 'local_credential' });
    }

    const refreshToken = decryptOAuthToken(account.refresh_token);
    if (!refreshToken) {
        const message = `Failed to decrypt refresh token for account ${account.id} (${account.providerId}).`;
        logger.error(message);
        await setTokenRefreshError(account.id, message, db);
        throw new TokenRefreshError(message, { kind: 'local_credential' });
    }

    logger.debug(`Refreshing OAuth token for account ${account.id} (${account.providerId})...`);

    const refreshResponse = await refreshOAuthToken(
        account.providerId,
        account.providerType,
        refreshToken
    ).catch(async (error: unknown) => {
        const message = getErrorMessage(error);
        logger.error(`OAuth token refresh failed for account ${account.id} (${account.providerId}): ${message}`);
        await setTokenRefreshError(account.id, message, db);
        throw error;
    });

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
): Promise<OAuthTokenResponse> => {
    let credentials: ProviderCredentials;

    try {
        const idpConfig = await getIdentityProviderConfig(providerId);

        if (!idpConfig) {
            throw new TokenRefreshError(`No provider config found for: ${providerId}`, {
                kind: 'configuration',
            });
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

        credentials = { clientId, clientSecret, baseUrl };
    } catch (error) {
        if (error instanceof TokenRefreshError) {
            throw error;
        }

        const wrappedError = new TokenRefreshError(
            `Unexpected error refreshing ${providerType} token: ${getErrorMessage(error)}`,
            {
                kind: 'configuration',
                cause: error,
            },
        );
        logger.error(wrappedError.message);
        throw wrappedError;
    }

    return exchangeRefreshToken(providerType, refreshToken, credentials);
};

export const exchangeRefreshToken = async (
    providerType: SupportedProviderType,
    refreshToken: string,
    credentials: ProviderCredentials,
): Promise<OAuthTokenResponse> => {
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
        throw new TokenRefreshError(`Unsupported provider for token refresh: ${providerType}`, {
            kind: 'configuration',
        });
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

    for (let attempt = 1; attempt <= TOKEN_REFRESH_MAX_ATTEMPTS; attempt++) {
        try {
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
                signal: AbortSignal.timeout(TOKEN_REFRESH_TIMEOUT_MS),
            });

            return await parseTokenRefreshResponse(response, providerType);
        } catch (error) {
            const classifiedError = error instanceof TokenRefreshError
                ? error
                : classifyTokenRefreshFetchError(error, providerType);

            if (!classifiedError.isRetryable || attempt === TOKEN_REFRESH_MAX_ATTEMPTS) {
                throw classifiedError;
            }

            const delayMs = TOKEN_REFRESH_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
            logger.warn(
                `Transient ${providerType} token refresh failure. Waiting ${delayMs}ms before retry ${attempt}/${TOKEN_REFRESH_MAX_ATTEMPTS}: ${classifiedError.message}`,
            );
            await wait(delayMs);
        }
    }

    throw new TokenRefreshError(`${providerType} token refresh produced no response.`, {
        kind: 'invalid_response',
    });
};

const parseTokenRefreshResponse = async (
    response: Response,
    providerType: SupportedProviderType,
): Promise<OAuthTokenResponse> => {
    const responseText = await response.text();
    let json: unknown;
    try {
        json = JSON.parse(responseText);
    } catch (error) {
        if (!response.ok) {
            throw classifyTokenRefreshErrorResponse(response.status, providerType);
        }

        throw new TokenRefreshError(`${providerType} returned a non-JSON token response.`, {
            kind: 'invalid_response',
            cause: error,
        });
    }

    const oauthErrorResult = OAuthErrorResponseSchema.safeParse(json);
    if (oauthErrorResult.success) {
        throw classifyTokenRefreshErrorResponse(
            response.status,
            providerType,
            oauthErrorResult.data,
        );
    }

    if (!response.ok) {
        throw classifyTokenRefreshErrorResponse(response.status, providerType);
    }

    const result = OAuthTokenResponseSchema.safeParse(json);

    if (!result.success) {
        throw new TokenRefreshError(`Invalid OAuth token response from ${providerType}: ${result.error.message}`, {
            kind: 'invalid_response',
        });
    }

    return result.data;
};

const classifyTokenRefreshFetchError = (
    error: unknown,
    providerType: SupportedProviderType,
): TokenRefreshError => {
    const errorName = error instanceof Error ? error.name : undefined;
    const timedOut = errorName === 'TimeoutError' || errorName === 'AbortError';

    return new TokenRefreshError(
        timedOut
            ? `${providerType} token refresh timed out.`
            : `${providerType} token endpoint could not be reached: ${getErrorMessage(error)}`,
        {
            kind: 'transient',
            cause: error,
        },
    );
};

const classifyTokenRefreshErrorResponse = (
    status: number,
    providerType: SupportedProviderType,
    oauthErrorResponse?: OAuthErrorResponse,
): TokenRefreshError => {
    const oauthError = oauthErrorResponse?.error;
    const errorDescription = oauthErrorResponse?.error_description;
    const details = errorDescription ? `: ${errorDescription}` : '';
    const isRefreshTokenRejected =
        oauthError === 'invalid_grant' ||
        (providerType === 'github' && oauthError === 'bad_refresh_token');

    if (isRefreshTokenRejected) {
        return new TokenRefreshError(`${providerType} rejected the OAuth refresh token${details}`, {
            kind: 'refresh_token_rejected',
            status,
            oauthError,
            errorDescription,
        });
    }

    if (
        status === 408 ||
        status === 429 ||
        status >= 500 ||
        oauthError === 'server_error' ||
        oauthError === 'temporarily_unavailable'
    ) {
        return new TokenRefreshError(
            `${providerType} token endpoint is temporarily unavailable (HTTP ${status})${details}`,
            {
                kind: 'transient',
                status,
                oauthError,
                errorDescription,
            },
        );
    }

    return new TokenRefreshError(
        `${providerType} token endpoint rejected the refresh request (HTTP ${status})${details}`,
        {
            kind: 'configuration',
            status,
            oauthError,
            errorDescription,
        },
    );
};
