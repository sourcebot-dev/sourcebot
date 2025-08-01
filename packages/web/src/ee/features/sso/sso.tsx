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
import {- HttpsProxyAgent } from "https-proxy-agent";
import { Client, SearchOptions, ldapsearch } from "ldapjs";
import { verifyLdapRequestSchema } from "@/lib/schemas";

const logger = createLogger('web-sso');

export const getSSOProviders = (): Provider[] => {
    const providers: Provider[] = [];

    if (env.AUTH_EE_GITHUB_CLIENT_ID && env.AUTH_EE_GITHUB_CLIENT_SECRET) {
        const baseUrl = env.AUTH_EE_GITHUB_BASE_URL ?? "https://github.com";
        const apiUrl = env.AUTH_EE_GITHUB_BASE_URL ? `${env.AUTH_EE_GITHUB_BASE_URL}/api/v3` : "https://api.github.com";
        providers.push(GitHub({
            clientId: env.AUTH_EE_GITHUB_CLIENT_ID,
            clientSecret: env.AUTH_EE_GITHUB_CLIENT_SECRET,
            authorization: {
                url: `${baseUrl}/login/oauth/authorize`,
                params: {
                    scope: "read:user user:email",
                },
            },
            token: {
                url: `${baseUrl}/login/oauth/access_token`,
            },
            userinfo: {
                url: `${apiUrl}/user`,
            },
        }));
    }

    if (env.AUTH_EE_GITLAB_CLIENT_ID && env.AUTH_EE_GITLAB_CLIENT_SECRET) {
        providers.push(Gitlab({
            clientId: env.AUTH_EE_GITLAB_CLIENT_ID,
            clientSecret: env.AUTH_EE_GITLAB_CLIENT_SECRET,
            authorization: {
                url: `${env.AUTH_EE_GITLAB_BASE_URL}/oauth/authorize`,
                params: {
                    scope: "read_user",
                },
            },
            token: {
                url: `${env.AUTH_EE_GITLAB_BASE_URL}/oauth/token`,
            },
            userinfo: {
                url: `${env.AUTH_EE_GITLAB_BASE_URL}/api/v4/user`,
            },
        }));
    }

    if (env.AUTH_EE_GOOGLE_CLIENT_ID && env.AUTH_EE_GOOGLE_CLIENT_SECRET) {
        providers.push(Google({
            clientId: env.AUTH_EE_GOOGLE_CLIENT_ID,
            clientSecret: env.AUTH_EE_GOOGLE_CLIENT_SECRET,
        }));
    }

    if (env.AUTH_EE_OKTA_CLIENT_ID && env.AUTH_EE_OKTA_CLIENT_SECRET && env.AUTH_EE_OKTA_ISSUER) {
        providers.push(Okta({
            clientId: env.AUTH_EE_OKTA_CLIENT_ID,
            clientSecret: env.AUTH_EE_OKTA_CLIENT_SECRET,
            issuer: env.AUTH_EE_OKTA_ISSUER,
        }));
    }

    if (env.AUTH_EE_KEYCLOAK_CLIENT_ID && env.AUTH_EE_KEYCLOAK_CLIENT_SECRET && env.AUTH_EE_KEYCLOAK_ISSUER) {
        providers.push(Keycloak({
            clientId: env.AUTH_EE_KEYCLOAK_CLIENT_ID,
            clientSecret: env.AUTH_EE_KEYCLOAK_CLIENT_SECRET,
            issuer: env.AUTH_EE_KEYCLOAK_ISSUER,
        }));
    }

    if (env.AUTH_EE_MICROSOFT_ENTRA_ID_CLIENT_ID && env.AUTH_EE_MICROSOFT_ENTRA_ID_CLIENT_SECRET && env.AUTH_EE_MICROSOFT_ENTRA_ID_ISSUER) {
        providers.push(MicrosoftEntraID({
            clientId: env.AUTH_EE_MICROSOFT_ENTRA_ID_CLIENT_ID,
            clientSecret: env.AUTH_EE_MICROSOFT_ENTRA_ID_CLIENT_SECRET,
            issuer: env.AUTH_EE_MICROSOFT_ENTRA_ID_ISSUER,
        }));
    }

    if (env.AUTH_EE_GCP_IAP_ENABLED && env.AUTH_EE_GCP_IAP_AUDIENCE) {
        providers.push(Credentials({
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
                        env.AUTH_EE_GCP_IAP_AUDIENCE,
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
        }));
    }

    if (env.AUTH_EE_LDAP_URL) {
        providers.push(Credentials({
            id: "ldap",
            name: "LDAP",
            credentials: {
                email: {},
                password: {}
            },
            authorize: async (credentials) => {
                try {
                    const body = verifyLdapRequestSchema.safeParse(credentials);
                    if (!body.success) {
                        return null;
                    }
                    const { email, password } = body.data;

                    const client = new Client({
                        url: env.AUTH_EE_LDAP_URL,
                        tlsOptions: {
                            rejectUnauthorized: env.AUTH_EE_LDAP_REJECT_UNAUTHORIZED === 'true'
                        },
                        ...((env.AUTH_EE_LDAP_PROXY) && { agent: new HttpsProxyAgent(env.AUTH_EE_LDAP_PROXY) })
                    });

                    const bindDN = env.AUTH_EE_LDAP_BIND_DN;
                    const bindPassword = env.AUTH_EE_LDAP_BIND_PASSWORD;
                    if (bindDN && bindPassword) {
                        await new Promise<void>((resolve, reject) => {
                            client.bind(bindDN, bindPassword, (err) => {
                                if (err) {
                                    logger.error("LDAP bind error:", err);
                                    return reject(err);
                                }
                                resolve();
                            });
                        });
                    }

                    const searchBase = env.AUTH_EE_LDAP_BASE_DN;
                    const opts: SearchOptions = {
                        filter: `(${env.AUTH_EE_LDAP_USER_EMAIL_ATTRIBUTE ?? 'mail'}=${email})`,
                        scope: 'sub',
                        attributes: ['dn']
                    };

                    const userDN = await new Promise<string>((resolve, reject) => {
                        client.search(searchBase, opts, (err, res) => {
                            if (err) {
                                return reject(err);
                            }
                            res.on('searchEntry', (entry) => {
                                resolve(entry.objectName);
                            });
                            res.on('error', (err) => {
                                reject(err);
                            });
                            res.on('end', (result) => {
                                if (result?.status !== 0) {
                                    reject(new Error(`LDAP search failed with status ${result?.status}`));
                                }
                            });
                        });
                    });

                    if (!userDN) {
                        return null;
                    }

                    await new Promise<void>((resolve, reject) => {
                        client.bind(userDN, password, (err) => {
                            if (err) {
                                return reject(err);
                            }
                            resolve();
                        });
                    });

                    const existingUser = await prisma.user.findUnique({
                        where: { email }
                    });

                    if (!existingUser) {
                        const newUser = await prisma.user.create({
                            data: {
                                email
                            }
                        });

                        const authJsUser: AuthJsUser = {
                            id: newUser.id,
                            email: newUser.email
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
                    logger.error("Error authenticating with LDAP:", error);
                    return null;
                }
            },
        }));
    }

    return providers;
}