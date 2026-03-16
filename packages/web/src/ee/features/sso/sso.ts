import type { IdentityProvider } from "@/auth";
import { onCreateUser } from "@/lib/authUtils";
import { prisma } from "@/prisma";
import { AuthentikIdentityProviderConfig, BitbucketCloudIdentityProviderConfig, BitbucketServerIdentityProviderConfig, GCPIAPIdentityProviderConfig, GitHubIdentityProviderConfig, GitLabIdentityProviderConfig, GoogleIdentityProviderConfig, JumpCloudIdentityProviderConfig, KeycloakIdentityProviderConfig, MicrosoftEntraIDIdentityProviderConfig, OktaIdentityProviderConfig } from "@sourcebot/schemas/v3/index.type";
import type { IdentityProviderType } from "@sourcebot/shared";
import { createLogger, env, getTokenFromConfig, hasEntitlement, loadConfig } from "@sourcebot/shared";
import { OAuth2Client } from "google-auth-library";
import type { User as AuthJsUser } from "next-auth";
import type { Provider } from "next-auth/providers";
import type { TokenSet } from "@auth/core/types";
import Authentik from "next-auth/providers/authentik";
import Bitbucket from "next-auth/providers/bitbucket";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Gitlab from "next-auth/providers/gitlab";
import Google from "next-auth/providers/google";
import Keycloak from "next-auth/providers/keycloak";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Okta from "next-auth/providers/okta";

const logger = createLogger('web-sso');

export const getEEIdentityProviders = async (): Promise<IdentityProvider[]> => {
    const providers: IdentityProvider[] = [];

    const config = await loadConfig(env.CONFIG_PATH);
    const identityProviders = config?.identityProviders ?? [];

    for (const identityProvider of identityProviders) {
        if (identityProvider.provider === "github") {
            const providerConfig = identityProvider as GitHubIdentityProviderConfig;
            const clientId = await getTokenFromConfig(providerConfig.clientId);
            const clientSecret = await getTokenFromConfig(providerConfig.clientSecret);
            const baseUrl = (providerConfig.baseUrl ?? 'https://github.com').replace(/\/+$/, '');
            providers.push({
                provider: createGitHubProvider(clientId, clientSecret, baseUrl),
                purpose: providerConfig.purpose,
                required: providerConfig.accountLinkingRequired ?? false,
                issuerUrl: baseUrl,
            });
        }

        if (identityProvider.provider === "gitlab") {
            const providerConfig = identityProvider as GitLabIdentityProviderConfig;
            const clientId = await getTokenFromConfig(providerConfig.clientId);
            const clientSecret = await getTokenFromConfig(providerConfig.clientSecret);
            const baseUrl = (providerConfig.baseUrl ?? 'https://gitlab.com').replace(/\/+$/, '');
            providers.push({
                provider: createGitLabProvider(clientId, clientSecret, baseUrl),
                purpose: providerConfig.purpose,
                required: providerConfig.accountLinkingRequired ?? false,
                issuerUrl: baseUrl,
            });
        }

        if (identityProvider.provider === "google") {
            const providerConfig = identityProvider as GoogleIdentityProviderConfig;
            const clientId = await getTokenFromConfig(providerConfig.clientId);
            const clientSecret = await getTokenFromConfig(providerConfig.clientSecret);
            providers.push({
                provider: createGoogleProvider(clientId, clientSecret),
                purpose: providerConfig.purpose,
                issuerUrl: 'https://accounts.google.com'
            });
        }

        if (identityProvider.provider === "okta") {
            const providerConfig = identityProvider as OktaIdentityProviderConfig;
            const clientId = await getTokenFromConfig(providerConfig.clientId);
            const clientSecret = await getTokenFromConfig(providerConfig.clientSecret);
            const issuer = (await getTokenFromConfig(providerConfig.issuer)).replace(/\/+$/, '');
            providers.push({
                provider: createOktaProvider(clientId, clientSecret, issuer),
                purpose: providerConfig.purpose,
                issuerUrl: issuer
            });
        }

        if (identityProvider.provider === "keycloak") {
            const providerConfig = identityProvider as KeycloakIdentityProviderConfig;
            const clientId = await getTokenFromConfig(providerConfig.clientId);
            const clientSecret = await getTokenFromConfig(providerConfig.clientSecret);
            const issuer = (await getTokenFromConfig(providerConfig.issuer)).replace(/\/+$/, '');
            providers.push({
                provider: createKeycloakProvider(clientId, clientSecret, issuer),
                purpose: providerConfig.purpose,
                issuerUrl: issuer
            });
        }

        if (identityProvider.provider === "microsoft-entra-id") {
            const providerConfig = identityProvider as MicrosoftEntraIDIdentityProviderConfig;
            const clientId = await getTokenFromConfig(providerConfig.clientId);
            const clientSecret = await getTokenFromConfig(providerConfig.clientSecret);
            const issuer = (await getTokenFromConfig(providerConfig.issuer)).replace(/\/+$/, '');
            providers.push({
                provider: createMicrosoftEntraIDProvider(clientId, clientSecret, issuer),
                purpose: providerConfig.purpose,
                issuerUrl: issuer
            });
        }

        if (identityProvider.provider === "gcp-iap") {
            const providerConfig = identityProvider as GCPIAPIdentityProviderConfig;
            const audience = await getTokenFromConfig(providerConfig.audience);
            providers.push({
                provider: createGCPIAPProvider(audience),
                purpose: providerConfig.purpose
            });
        }

        if (identityProvider.provider === "bitbucket-cloud") {
            const providerConfig = identityProvider as BitbucketCloudIdentityProviderConfig;
            const clientId = await getTokenFromConfig(providerConfig.clientId);
            const clientSecret = await getTokenFromConfig(providerConfig.clientSecret);
            providers.push({
                provider: createBitbucketCloudProvider(clientId, clientSecret),
                purpose: providerConfig.purpose,
                required: providerConfig.accountLinkingRequired ?? false,
                issuerUrl: 'https://bitbucket.org'
            });
        }

        if (identityProvider.provider === "authentik") {
            const providerConfig = identityProvider as AuthentikIdentityProviderConfig;
            const clientId = await getTokenFromConfig(providerConfig.clientId);
            const clientSecret = await getTokenFromConfig(providerConfig.clientSecret);
            const issuer = (await getTokenFromConfig(providerConfig.issuer)).replace(/\/+$/, '');
            providers.push({
                provider: createAuthentikProvider(clientId, clientSecret, issuer),
                purpose: providerConfig.purpose,
                issuerUrl: issuer
            });
        }

        if (identityProvider.provider === "jumpcloud") {
            const providerConfig = identityProvider as JumpCloudIdentityProviderConfig;
            const clientId = await getTokenFromConfig(providerConfig.clientId);
            const clientSecret = await getTokenFromConfig(providerConfig.clientSecret);
            const issuer = (await getTokenFromConfig(providerConfig.issuer)).replace(/\/+$/, '');
            providers.push({
                provider: createJumpCloudProvider(clientId, clientSecret, issuer),
                purpose: providerConfig.purpose,
                issuerUrl: issuer
            });
        }

        if (identityProvider.provider === "bitbucket-server") {
            const providerConfig = identityProvider as BitbucketServerIdentityProviderConfig;
            const clientId = await getTokenFromConfig(providerConfig.clientId);
            const clientSecret = await getTokenFromConfig(providerConfig.clientSecret);
            const baseUrl = providerConfig.baseUrl.replace(/\/+$/, '');
            providers.push({
                provider: createBitbucketServerProvider(clientId, clientSecret, baseUrl),
                purpose: providerConfig.purpose,
                required: providerConfig.accountLinkingRequired ?? false,
                issuerUrl: baseUrl
            });
        }
    }

    // @deprecate in favor of defining identity providers throught the identityProvider object in the config file. This was done to allow for more control over
    // which identity providers are defined and their purpose. We've left this logic here to support backwards compat with deployments that expect these env vars,
    // but this logic will be removed in the future
    // We only go through this path if no identityProviders are defined in the config to prevent accidental duplication of providers
    if (identityProviders.length == 0) {
        if (env.AUTH_EE_GITHUB_CLIENT_ID && env.AUTH_EE_GITHUB_CLIENT_SECRET) {
            const baseUrl = (env.AUTH_EE_GITHUB_BASE_URL ?? 'https://github.com').replace(/\/+$/, '');
            providers.push({
                provider: createGitHubProvider(
                    env.AUTH_EE_GITHUB_CLIENT_ID,
                    env.AUTH_EE_GITHUB_CLIENT_SECRET,
                    baseUrl
                ),
                purpose: "sso",
                issuerUrl: baseUrl
            });
        }

        if (env.AUTH_EE_GITLAB_CLIENT_ID && env.AUTH_EE_GITLAB_CLIENT_SECRET) {
            const baseUrl = (env.AUTH_EE_GITLAB_BASE_URL ?? 'https://gitlab.com').replace(/\/+$/, '');
            providers.push({
                provider: createGitLabProvider(
                    env.AUTH_EE_GITLAB_CLIENT_ID,
                    env.AUTH_EE_GITLAB_CLIENT_SECRET,
                    baseUrl,
                ),
                purpose: "sso",
                issuerUrl: baseUrl
            });
        }

        if (env.AUTH_EE_GOOGLE_CLIENT_ID && env.AUTH_EE_GOOGLE_CLIENT_SECRET) {
            providers.push({
                provider: createGoogleProvider(env.AUTH_EE_GOOGLE_CLIENT_ID, env.AUTH_EE_GOOGLE_CLIENT_SECRET),
                purpose: "sso",
                issuerUrl: 'https://accounts.google.com'
            });
        }

        if (env.AUTH_EE_OKTA_CLIENT_ID && env.AUTH_EE_OKTA_CLIENT_SECRET && env.AUTH_EE_OKTA_ISSUER) {
            const issuer = env.AUTH_EE_OKTA_ISSUER.replace(/\/+$/, '');
            providers.push({
                provider: createOktaProvider(env.AUTH_EE_OKTA_CLIENT_ID, env.AUTH_EE_OKTA_CLIENT_SECRET, issuer),
                purpose: "sso",
                issuerUrl: issuer
            });
        }

        if (env.AUTH_EE_KEYCLOAK_CLIENT_ID && env.AUTH_EE_KEYCLOAK_CLIENT_SECRET && env.AUTH_EE_KEYCLOAK_ISSUER) {
            const issuer = env.AUTH_EE_KEYCLOAK_ISSUER.replace(/\/+$/, '');
            providers.push({
                provider: createKeycloakProvider(env.AUTH_EE_KEYCLOAK_CLIENT_ID, env.AUTH_EE_KEYCLOAK_CLIENT_SECRET, issuer),
                purpose: "sso",
                issuerUrl: issuer
            });
        }

        if (env.AUTH_EE_MICROSOFT_ENTRA_ID_CLIENT_ID && env.AUTH_EE_MICROSOFT_ENTRA_ID_CLIENT_SECRET && env.AUTH_EE_MICROSOFT_ENTRA_ID_ISSUER) {
            const issuer = env.AUTH_EE_MICROSOFT_ENTRA_ID_ISSUER.replace(/\/+$/, '');
            providers.push({
                provider: createMicrosoftEntraIDProvider(env.AUTH_EE_MICROSOFT_ENTRA_ID_CLIENT_ID, env.AUTH_EE_MICROSOFT_ENTRA_ID_CLIENT_SECRET, issuer),
                purpose: "sso",
                issuerUrl: issuer
            });
        }

        if (env.AUTH_EE_GCP_IAP_ENABLED && env.AUTH_EE_GCP_IAP_AUDIENCE) {
            providers.push({
                provider: createGCPIAPProvider(env.AUTH_EE_GCP_IAP_AUDIENCE),
                purpose: "sso"
            });
        }
    }

    return providers;
}

const createGitHubProvider = (clientId: string, clientSecret: string, baseUrl: string) => {
    return GitHub({
        id: 'github' satisfies IdentityProviderType,
        clientId: clientId,
        clientSecret: clientSecret,
        // if this is set the provider expects GHE so we need this check
        ...(baseUrl !== 'https://github.com' ? {
            enterprise: { baseUrl: baseUrl }
        } : {}),
        authorization: {
            params: {
                scope: [
                    'read:user',
                    'user:email',
                    // Permission syncing requires the `repo` scope in order to fetch repositories
                    // for the authenticated user.
                    // @see: https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#list-repositories-for-the-authenticated-user
                    ...(env.PERMISSION_SYNC_ENABLED === 'true' && hasEntitlement('permission-syncing') ?
                        ['repo'] :
                        []
                    ),
                ].join(' '),
            },
        },
        allowDangerousEmailAccountLinking: env.AUTH_EE_ALLOW_EMAIL_ACCOUNT_LINKING === 'true',
    });
}

const createGitLabProvider = (clientId: string, clientSecret: string, baseUrl: string) => {
    return Gitlab({
        id: 'gitlab' satisfies IdentityProviderType,
        clientId: clientId,
        clientSecret: clientSecret,
        authorization: {
            url: `${baseUrl}/oauth/authorize`,
            params: {
                scope: [
                    "read_user",
                    // Permission syncing requires the `read_api` scope in order to fetch projects
                    // for the authenticated user and project members.
                    // @see: https://docs.gitlab.com/ee/api/projects.html#list-all-projects
                    ...(env.PERMISSION_SYNC_ENABLED === 'true' && hasEntitlement('permission-syncing') ?
                        ['read_api'] :
                        []
                    ),
                ].join(' '),
            },
        },
        token: {
            url: `${baseUrl}/oauth/token`,
        },
        userinfo: {
            url: `${baseUrl}/api/v4/user`,
        },
        allowDangerousEmailAccountLinking: env.AUTH_EE_ALLOW_EMAIL_ACCOUNT_LINKING === 'true',
    });
}

const createGoogleProvider = (clientId: string, clientSecret: string) => {
    return Google({
        id: 'google' satisfies IdentityProviderType,
        clientId: clientId,
        clientSecret: clientSecret,
        allowDangerousEmailAccountLinking: env.AUTH_EE_ALLOW_EMAIL_ACCOUNT_LINKING === 'true',
    });
}

const createOktaProvider = (clientId: string, clientSecret: string, issuer: string): Provider => {
    return Okta({
        id: 'okta' satisfies IdentityProviderType,
        clientId: clientId,
        clientSecret: clientSecret,
        issuer: issuer,
        allowDangerousEmailAccountLinking: env.AUTH_EE_ALLOW_EMAIL_ACCOUNT_LINKING === 'true',
    });
}

const createKeycloakProvider = (clientId: string, clientSecret: string, issuer: string): Provider => {
    return Keycloak({
        id: 'keycloak' satisfies IdentityProviderType,
        clientId: clientId,
        clientSecret: clientSecret,
        issuer: issuer,
        allowDangerousEmailAccountLinking: env.AUTH_EE_ALLOW_EMAIL_ACCOUNT_LINKING === 'true',
    });
}

const createMicrosoftEntraIDProvider = (clientId: string, clientSecret: string, issuer: string): Provider => {
    return MicrosoftEntraID({
        id: 'microsoft-entra-id' satisfies IdentityProviderType,
        clientId: clientId,
        clientSecret: clientSecret,
        issuer: issuer,
        allowDangerousEmailAccountLinking: env.AUTH_EE_ALLOW_EMAIL_ACCOUNT_LINKING === 'true',
    });
}

const createBitbucketCloudProvider = (clientId: string, clientSecret: string): Provider => {
    return Bitbucket({
        id: 'bitbucket-cloud' satisfies IdentityProviderType,
        name: "Bitbucket Cloud",
        clientId,
        clientSecret,
        authorization: {
            url: "https://bitbucket.org/site/oauth2/authorize",
            params: {
                scope: [
                    "account",
                    "email",
                    ...(env.PERMISSION_SYNC_ENABLED === 'true' && hasEntitlement('permission-syncing') ?
                        ['repository'] :
                        []
                    ),
                ].join(' '),
            },
        },
        allowDangerousEmailAccountLinking: env.AUTH_EE_ALLOW_EMAIL_ACCOUNT_LINKING === 'true',
    });
}

const createBitbucketServerProvider = (clientId: string, clientSecret: string, baseUrl: string): Provider => {
    return {
        id: 'bitbucket-server' satisfies IdentityProviderType,
        name: "Bitbucket Server",
        type: "oauth",
        clientId,
        clientSecret,
        authorization: {
            url: `${baseUrl}/rest/oauth2/latest/authorize`,
            params: {
                response_type: "code",
                // @see: https://confluence.atlassian.com/bitbucketserver/bitbucket-oauth-2-0-provider-api-1108483661.html
                scope: [
                    "PUBLIC_REPOS",
                    ...(env.PERMISSION_SYNC_ENABLED === 'true' && hasEntitlement('permission-syncing')
                        ? ['REPO_READ']
                        : []),
                ].join(' ')
            },
        },
        token: { url: `${baseUrl}/rest/oauth2/latest/token` },
        // Bitbucket Server expects client credentials as body params, not Basic Auth header
        client: { token_endpoint_auth_method: "client_secret_post" },
        userinfo: {
            // url is required by Auth.js endpoint validation; the request function overrides the actual fetch
            url: `${baseUrl}/plugins/servlet/applinks/whoami`,
            async request({ tokens }: { tokens: TokenSet }) {
                const accessToken = tokens.access_token;
                if (!accessToken) {
                    throw new Error("Missing access token for Bitbucket Server userinfo request");
                }

                const whoamiRes = await fetch(`${baseUrl}/plugins/servlet/applinks/whoami`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    signal: AbortSignal.timeout(10_000),
                });
                if (!whoamiRes.ok) {
                    throw new Error(`Bitbucket whoami failed (${whoamiRes.status})`);
                }

                const username = (await whoamiRes.text()).trim();
                if (!username) {
                    throw new Error("Bitbucket whoami returned an empty username");
                }

                const profileRes = await fetch(`${baseUrl}/rest/api/1.0/users/${encodeURIComponent(username)}`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    signal: AbortSignal.timeout(10_000),
                });
                if (!profileRes.ok) {
                    throw new Error(`Bitbucket profile lookup failed (${profileRes.status})`);
                }

                return await profileRes.json();
            }
        },
        profile(profile) {
            return {
                id: String(profile.id),
                name: profile.displayName,
                email: profile.emailAddress,
                image: null,
            };
        },
        allowDangerousEmailAccountLinking: env.AUTH_EE_ALLOW_EMAIL_ACCOUNT_LINKING === 'true',
    } as Provider;
}

export const createAuthentikProvider = (clientId: string, clientSecret: string, issuer: string): Provider => {
    return Authentik({
        id: 'authentik' satisfies IdentityProviderType,
        clientId: clientId,
        clientSecret: clientSecret,
        issuer: issuer,
        allowDangerousEmailAccountLinking: env.AUTH_EE_ALLOW_EMAIL_ACCOUNT_LINKING === 'true',
    });
}

const createJumpCloudProvider = (clientId: string, clientSecret: string, issuer: string): Provider => {
    return {
        id: 'jumpcloud' satisfies IdentityProviderType,
        name: "JumpCloud",
        type: "oidc",
        clientId: clientId,
        clientSecret: clientSecret,
        issuer: issuer,
        allowDangerousEmailAccountLinking: env.AUTH_EE_ALLOW_EMAIL_ACCOUNT_LINKING === 'true',
    } as Provider;
}

const createGCPIAPProvider = (audience: string): Provider => {
    return Credentials({
        id: 'gcp-iap' satisfies IdentityProviderType,
        name: "Google Cloud IAP",
        credentials: {},
        authorize: async (_credentials, req) => {
            try {
                const iapAssertion = req.headers?.get("x-goog-iap-jwt-assertion");
                if (!iapAssertion || typeof iapAssertion !== "string") {
                    logger.warn("No IAP assertion found in headers");
                    return null;
                }

                const oauth2Client = new OAuth2Client();

                const { pubkeys } = await oauth2Client.getIapPublicKeys();
                const ticket = await oauth2Client.verifySignedJwtWithCertsAsync(
                    iapAssertion,
                    pubkeys,
                    audience,
                    ['https://cloud.google.com/iap']
                );

                const payload = ticket.getPayload();
                if (!payload) {
                    logger.warn("Invalid IAP token payload");
                    return null;
                }

                const email = payload.email;
                const name = payload.name || payload.email;
                const image = payload.picture;

                if (!email) {
                    logger.warn("Missing email in IAP token");
                    return null;
                }

                const existingUser = await prisma.user.findUnique({
                    where: { email }
                });

                if (!existingUser) {
                    const newUser = await prisma.user.create({
                        data: {
                            email,
                            name,
                            image,
                        }
                    });

                    const authJsUser: AuthJsUser = {
                        id: newUser.id,
                        email: newUser.email,
                        name: newUser.name,
                        image: newUser.image,
                    };

                    await onCreateUser({ user: authJsUser });
                    return authJsUser;
                } else {
                    return {
                        id: existingUser.id,
                        email: existingUser.email,
                        name: existingUser.name,
                        image: existingUser.image,
                    };
                }
            } catch (error) {
                logger.error("Error verifying IAP token:", error);
                return null;
            }
        },
    });
}
