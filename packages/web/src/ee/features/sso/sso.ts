import { env } from "@sourcebot/shared";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Okta from "next-auth/providers/okta";
import Keycloak from "next-auth/providers/keycloak";
import Gitlab from "next-auth/providers/gitlab";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { prisma } from "@/prisma";
import { OAuth2Client } from "google-auth-library";
import Credentials from "next-auth/providers/credentials";
import type { User as AuthJsUser } from "next-auth";
import type { Provider } from "next-auth/providers";
import { onCreateUser } from "@/lib/authUtils";
import { hasEntitlement, loadConfig } from "@sourcebot/shared";
import { getTokenFromConfig } from "@sourcebot/crypto";
import type { IdentityProvider } from "@/auth";
import { GCPIAPIdentityProviderConfig, GitHubIdentityProviderConfig, GitLabIdentityProviderConfig, GoogleIdentityProviderConfig, KeycloakIdentityProviderConfig, MicrosoftEntraIDIdentityProviderConfig, OktaIdentityProviderConfig } from "@sourcebot/schemas/v3/index.type";
import { createLogger } from "@sourcebot/shared";

const logger = createLogger('web-sso');

const GITHUB_CLOUD_HOSTNAME = "github.com"

export const getEEIdentityProviders = async (): Promise<IdentityProvider[]> => {
    const providers: IdentityProvider[] = [];

    const config = await loadConfig(env.CONFIG_PATH);
    const identityProviders = config?.identityProviders ?? [];

    for (const identityProvider of identityProviders) {
        if (identityProvider.provider === "github") {
            const providerConfig = identityProvider as GitHubIdentityProviderConfig;
            const clientId = await getTokenFromConfig(providerConfig.clientId);
            const clientSecret = await getTokenFromConfig(providerConfig.clientSecret);
            const baseUrl = providerConfig.baseUrl;
            providers.push({ provider: createGitHubProvider(clientId, clientSecret, baseUrl), purpose: providerConfig.purpose, required: providerConfig.accountLinkingRequired ?? false});
        }
        if (identityProvider.provider === "gitlab") {
            const providerConfig = identityProvider as GitLabIdentityProviderConfig;
            const clientId = await getTokenFromConfig(providerConfig.clientId);
            const clientSecret = await getTokenFromConfig(providerConfig.clientSecret);
            const baseUrl = providerConfig.baseUrl;
            providers.push({ provider: createGitLabProvider(clientId, clientSecret, baseUrl), purpose: providerConfig.purpose, required: providerConfig.accountLinkingRequired ?? false});
        }
        if (identityProvider.provider === "google") {
            const providerConfig = identityProvider as GoogleIdentityProviderConfig;
            const clientId = await getTokenFromConfig(providerConfig.clientId);
            const clientSecret = await getTokenFromConfig(providerConfig.clientSecret);
            providers.push({ provider: createGoogleProvider(clientId, clientSecret), purpose: providerConfig.purpose});
        }
        if (identityProvider.provider === "okta") {
            const providerConfig = identityProvider as OktaIdentityProviderConfig;
            const clientId = await getTokenFromConfig(providerConfig.clientId);
            const clientSecret = await getTokenFromConfig(providerConfig.clientSecret);
            const issuer = await getTokenFromConfig(providerConfig.issuer);
            providers.push({ provider: createOktaProvider(clientId, clientSecret, issuer), purpose: providerConfig.purpose});
        }
        if (identityProvider.provider === "keycloak") {
            const providerConfig = identityProvider as KeycloakIdentityProviderConfig;
            const clientId = await getTokenFromConfig(providerConfig.clientId);
            const clientSecret = await getTokenFromConfig(providerConfig.clientSecret);
            const issuer = await getTokenFromConfig(providerConfig.issuer);
            providers.push({ provider: createKeycloakProvider(clientId, clientSecret, issuer), purpose: providerConfig.purpose });
        }
        if (identityProvider.provider === "microsoft-entra-id") {
            const providerConfig = identityProvider as MicrosoftEntraIDIdentityProviderConfig;
            const clientId = await getTokenFromConfig(providerConfig.clientId);
            const clientSecret = await getTokenFromConfig(providerConfig.clientSecret);
            const issuer = await getTokenFromConfig(providerConfig.issuer);
            providers.push({ provider: createMicrosoftEntraIDProvider(clientId, clientSecret, issuer), purpose: providerConfig.purpose });
        }
        if (identityProvider.provider === "gcp-iap") {
            const providerConfig = identityProvider as GCPIAPIdentityProviderConfig;
            const audience = await getTokenFromConfig(providerConfig.audience);
            providers.push({ provider: createGCPIAPProvider(audience), purpose: providerConfig.purpose });
        }
    }

    // @deprecate in favor of defining identity providers throught the identityProvider object in the config file. This was done to allow for more control over
    // which identity providers are defined and their purpose. We've left this logic here to support backwards compat with deployments that expect these env vars,
    // but this logic will be removed in the future
    // We only go through this path if no identityProviders are defined in the config to prevent accidental duplication of providers
    if (identityProviders.length == 0) {
        if (env.AUTH_EE_GITHUB_CLIENT_ID && env.AUTH_EE_GITHUB_CLIENT_SECRET) {
            providers.push({ provider: createGitHubProvider(env.AUTH_EE_GITHUB_CLIENT_ID, env.AUTH_EE_GITHUB_CLIENT_SECRET, env.AUTH_EE_GITHUB_BASE_URL), purpose: "sso" });
        }
        
        if (env.AUTH_EE_GITLAB_CLIENT_ID && env.AUTH_EE_GITLAB_CLIENT_SECRET) {
            providers.push({ provider: createGitLabProvider(env.AUTH_EE_GITLAB_CLIENT_ID, env.AUTH_EE_GITLAB_CLIENT_SECRET, env.AUTH_EE_GITLAB_BASE_URL), purpose: "sso" });
        }
        
        if (env.AUTH_EE_GOOGLE_CLIENT_ID && env.AUTH_EE_GOOGLE_CLIENT_SECRET) {
            providers.push({ provider: createGoogleProvider(env.AUTH_EE_GOOGLE_CLIENT_ID, env.AUTH_EE_GOOGLE_CLIENT_SECRET), purpose: "sso" });
        }
        
        if (env.AUTH_EE_OKTA_CLIENT_ID && env.AUTH_EE_OKTA_CLIENT_SECRET && env.AUTH_EE_OKTA_ISSUER) {
            providers.push({ provider: createOktaProvider(env.AUTH_EE_OKTA_CLIENT_ID, env.AUTH_EE_OKTA_CLIENT_SECRET, env.AUTH_EE_OKTA_ISSUER), purpose: "sso" });
        }
        
        if (env.AUTH_EE_KEYCLOAK_CLIENT_ID && env.AUTH_EE_KEYCLOAK_CLIENT_SECRET && env.AUTH_EE_KEYCLOAK_ISSUER) {
            providers.push({ provider: createKeycloakProvider(env.AUTH_EE_KEYCLOAK_CLIENT_ID, env.AUTH_EE_KEYCLOAK_CLIENT_SECRET, env.AUTH_EE_KEYCLOAK_ISSUER), purpose: "sso" });
        }
        
        if (env.AUTH_EE_MICROSOFT_ENTRA_ID_CLIENT_ID && env.AUTH_EE_MICROSOFT_ENTRA_ID_CLIENT_SECRET && env.AUTH_EE_MICROSOFT_ENTRA_ID_ISSUER) {
            providers.push({ provider: createMicrosoftEntraIDProvider(env.AUTH_EE_MICROSOFT_ENTRA_ID_CLIENT_ID, env.AUTH_EE_MICROSOFT_ENTRA_ID_CLIENT_SECRET, env.AUTH_EE_MICROSOFT_ENTRA_ID_ISSUER), purpose: "sso" });
        }
        
        if (env.AUTH_EE_GCP_IAP_ENABLED && env.AUTH_EE_GCP_IAP_AUDIENCE) {
            providers.push({ provider: createGCPIAPProvider(env.AUTH_EE_GCP_IAP_AUDIENCE), purpose: "sso" });
        }
    }
        
    return providers;
}

const createGitHubProvider = (clientId: string, clientSecret: string, baseUrl?: string): Provider => {
    const hostname = baseUrl ? new URL(baseUrl).hostname : GITHUB_CLOUD_HOSTNAME
    return GitHub({
        clientId: clientId,
        clientSecret: clientSecret,
        ...(hostname === GITHUB_CLOUD_HOSTNAME ? { enterprise: { baseUrl: baseUrl } } : {}), // if this is set the provider expects GHE so we need this check
        authorization: {
            params: {
                scope: [
                    'read:user',
                    'user:email',
                    // Permission syncing requires the `repo` scope in order to fetch repositories
                    // for the authenticated user.
                    // @see: https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#list-repositories-for-the-authenticated-user
                    ...(env.EXPERIMENT_EE_PERMISSION_SYNC_ENABLED === 'true' && hasEntitlement('permission-syncing') ?
                        ['repo'] :
                        []
                    ),
                ].join(' '),
            },
        },
    });
}

const createGitLabProvider = (clientId: string, clientSecret: string, baseUrl?: string): Provider => {
    const url = baseUrl ?? 'https://gitlab.com';
    return Gitlab({
        clientId: clientId,
        clientSecret: clientSecret,
        authorization: {
            url: `${url}/oauth/authorize`,
            params: {
                scope: [
                    "read_user",
                    // Permission syncing requires the `read_api` scope in order to fetch projects
                    // for the authenticated user and project members.
                    // @see: https://docs.gitlab.com/ee/api/projects.html#list-all-projects
                    ...(env.EXPERIMENT_EE_PERMISSION_SYNC_ENABLED === 'true' && hasEntitlement('permission-syncing') ?
                        ['read_api'] :
                        []
                    ),
                ].join(' '),
            },
        },
        token: {
            url: `${url}/oauth/token`,
        },
        userinfo: {
            url: `${url}/api/v4/user`,
        },
    });
}

const createGoogleProvider = (clientId: string, clientSecret: string): Provider => {
    return Google({
        clientId: clientId,
        clientSecret: clientSecret,
    });
}

const createOktaProvider = (clientId: string, clientSecret: string, issuer: string): Provider => {
    return Okta({
        clientId: clientId,
        clientSecret: clientSecret,
        issuer: issuer,
    });
}

const createKeycloakProvider = (clientId: string, clientSecret: string, issuer: string): Provider => {
    return Keycloak({
        clientId: clientId,
        clientSecret: clientSecret,
        issuer: issuer,
    });
}

const createMicrosoftEntraIDProvider = (clientId: string, clientSecret: string, issuer: string): Provider => {
    return MicrosoftEntraID({
        clientId: clientId,
        clientSecret: clientSecret,
        issuer: issuer,
    });
}

const createGCPIAPProvider = (audience: string): Provider => {
    return Credentials({
        id: "gcp-iap",
        name: "Google Cloud IAP",
        credentials: {},
        authorize: async (credentials, req) => {
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