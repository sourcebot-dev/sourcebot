import type { Provider } from "next-auth/providers";
import { env } from "@/env.mjs";
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
import { onCreateUser } from "@/lib/authUtils";
import { createLogger } from "@sourcebot/logger";
import { hasEntitlement, loadConfig } from "@sourcebot/shared";
import { getTokenFromConfig } from "@sourcebot/crypto";
import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";

const logger = createLogger('web-sso');

export const getSSOProviders = async (): Promise<Provider[]> => {
    const providers: Provider[] = [];

    const config = env.CONFIG_PATH ? await loadConfig(env.CONFIG_PATH) : undefined;
    const identityProviders = config?.identityProviders ?? [];

    for (const identityProvider of identityProviders) {
        if (identityProvider.provider === "github") {
            const clientId = await getTokenFromConfig(identityProvider.clientId, SINGLE_TENANT_ORG_ID, db);
            const clientSecret = await getTokenFromConfig(identityProvider.clientSecret, SINGLE_TENANT_ORG_ID, db);
            const baseUrl = identityProvider.baseUrl ? await getTokenFromConfig(identityProvider.baseUrl, SINGLE_TENANT_ORG_ID, db) : undefined;
            providers.push(createGitHubProvider(clientId, clientSecret, baseUrl));
        }
        if (identityProvider.provider === "gitlab") {
            const clientId = await getTokenFromConfig(identityProvider.clientId, SINGLE_TENANT_ORG_ID, db);
            const clientSecret = await getTokenFromConfig(identityProvider.clientSecret, SINGLE_TENANT_ORG_ID, db);
            const baseUrl = identityProvider.baseUrl ? await getTokenFromConfig(identityProvider.baseUrl, SINGLE_TENANT_ORG_ID, db) : undefined;
            providers.push(createGitLabProvider(clientId, clientSecret, baseUrl));
        }
    }

    if (env.AUTH_EE_GITHUB_CLIENT_ID && env.AUTH_EE_GITHUB_CLIENT_SECRET) {
        providers.push(createGitHubProvider(env.AUTH_EE_GITHUB_CLIENT_ID, env.AUTH_EE_GITHUB_CLIENT_SECRET, env.AUTH_EE_GITHUB_BASE_URL));
    }

    if (env.AUTH_EE_GITLAB_CLIENT_ID && env.AUTH_EE_GITLAB_CLIENT_SECRET) {
        providers.push(createGitLabProvider(env.AUTH_EE_GITLAB_CLIENT_ID, env.AUTH_EE_GITLAB_CLIENT_SECRET, env.AUTH_EE_GITLAB_BASE_URL));
    }

    if (env.AUTH_EE_GOOGLE_CLIENT_ID && env.AUTH_EE_GOOGLE_CLIENT_SECRET) {
        providers.push(createGoogleProvider(env.AUTH_EE_GOOGLE_CLIENT_ID, env.AUTH_EE_GOOGLE_CLIENT_SECRET));
    }

    if (env.AUTH_EE_OKTA_CLIENT_ID && env.AUTH_EE_OKTA_CLIENT_SECRET && env.AUTH_EE_OKTA_ISSUER) {
        providers.push(createOktaProvider(env.AUTH_EE_OKTA_CLIENT_ID, env.AUTH_EE_OKTA_CLIENT_SECRET, env.AUTH_EE_OKTA_ISSUER));
    }

    if (env.AUTH_EE_KEYCLOAK_CLIENT_ID && env.AUTH_EE_KEYCLOAK_CLIENT_SECRET && env.AUTH_EE_KEYCLOAK_ISSUER) {
        providers.push(createKeycloakProvider(env.AUTH_EE_KEYCLOAK_CLIENT_ID, env.AUTH_EE_KEYCLOAK_CLIENT_SECRET, env.AUTH_EE_KEYCLOAK_ISSUER));
    }

    if (env.AUTH_EE_MICROSOFT_ENTRA_ID_CLIENT_ID && env.AUTH_EE_MICROSOFT_ENTRA_ID_CLIENT_SECRET && env.AUTH_EE_MICROSOFT_ENTRA_ID_ISSUER) {
        providers.push(createMicrosoftEntraIDProvider(env.AUTH_EE_MICROSOFT_ENTRA_ID_CLIENT_ID, env.AUTH_EE_MICROSOFT_ENTRA_ID_CLIENT_SECRET, env.AUTH_EE_MICROSOFT_ENTRA_ID_ISSUER));
    }

    if (env.AUTH_EE_GCP_IAP_ENABLED && env.AUTH_EE_GCP_IAP_AUDIENCE) {
        providers.push(createGCPIAPProvider(env.AUTH_EE_GCP_IAP_AUDIENCE));
    }

    return providers;
}

const createGitHubProvider = (clientId: string, clientSecret: string, baseUrl?: string): Provider => {
    return GitHub({
        clientId: clientId,
        clientSecret: clientSecret,
        enterprise: {
            baseUrl: baseUrl,
        },
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