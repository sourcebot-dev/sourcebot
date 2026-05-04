import 'next-auth/jwt';
import { cache } from "react";
import NextAuth, { DefaultSession, Session, User as AuthJsUser } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import EmailProvider from "next-auth/providers/nodemailer";
import { __unsafePrisma } from "@/prisma";
import { env, getSMTPConnectionURL } from "@sourcebot/shared";
import { User } from '@sourcebot/db';
import 'next-auth/jwt';
import type { Provider } from "next-auth/providers";
import { verifyCredentialsRequestSchema } from './lib/schemas';
import { createTransport } from 'nodemailer';
import { render } from '@react-email/render';
import MagicLinkEmail from './emails/magicLinkEmail';
import bcrypt from 'bcryptjs';
import { getEEIdentityProviders } from '@/ee/features/sso/sso';
import { hasEntitlement } from '@sourcebot/shared';
import { onCreateUser } from '@/lib/authUtils';
import { getAuditService } from '@/ee/features/audit/factory';
import { SINGLE_TENANT_ORG_ID } from './lib/constants';
import { EncryptedPrismaAdapter, encryptAccountData } from '@/lib/encryptedPrismaAdapter';

const auditService = getAuditService();
const eeIdentityProviders = hasEntitlement("sso") ? await getEEIdentityProviders() : [];

export const runtime = 'nodejs';

export type IdentityProvider = {
    provider: Provider;
    purpose: "sso" | "account_linking";
    issuerUrl?: string;
    required?: boolean;
}

export type SessionUser = {
    id: string;
} & DefaultSession['user'];

declare module 'next-auth' {
    interface Session {
        user: SessionUser;
        sessionVersion?: number;
    }
    interface User {
        sessionVersion?: number;
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        userId: string;
        sessionVersion?: number;
    }
}

export const getProviders = () => {
    const providers: IdentityProvider[] = [...eeIdentityProviders];

    const smtpConnectionUrl = getSMTPConnectionURL();
    if (smtpConnectionUrl && env.EMAIL_FROM_ADDRESS && env.AUTH_EMAIL_CODE_LOGIN_ENABLED === 'true') {
        providers.push({
            provider: EmailProvider({
                server: smtpConnectionUrl,
                from: env.EMAIL_FROM_ADDRESS,
                maxAge: 60 * 10,
                generateVerificationToken: async () => {
                    const token = String(Math.floor(100000 + Math.random() * 900000));
                    return token;
                },
                sendVerificationRequest: async ({ identifier, provider, token }) => {
                    const transport = createTransport(provider.server);
                    const html = await render(MagicLinkEmail({ token: token }));
                    const result = await transport.sendMail({
                        to: identifier,
                        from: provider.from,
                        subject: 'Log in to Sourcebot',
                        html,
                        text: `Log in to Sourcebot using this code: ${token}`
                    });

                    const failed = result.rejected.concat(result.pending).filter(Boolean);
                    if (failed.length) {
                        throw new Error(`Email(s) (${failed.join(", ")}) could not be sent`);
                    }
                }
            }), purpose: "sso"
        });
    }

    if (env.AUTH_CREDENTIALS_LOGIN_ENABLED === 'true') {
        providers.push({
            provider: Credentials({
                credentials: {
                    email: {},
                    password: {}
                },
                type: "credentials",
                authorize: async (credentials) => {
                    const body = verifyCredentialsRequestSchema.safeParse(credentials);
                    if (!body.success) {
                        return null;
                    }
                    const { email, password } = body.data;

                    const user = await __unsafePrisma.user.findUnique({
                        where: { email }
                    });

                    // The user doesn't exist, so create a new one.
                    if (!user) {
                        const hashedPassword = bcrypt.hashSync(password, 10);
                        const newUser = await __unsafePrisma.user.create({
                            data: {
                                email,
                                hashedPassword,
                            }
                        });

                        const authJsUser: AuthJsUser = {
                            id: newUser.id,
                            email: newUser.email,
                            sessionVersion: newUser.sessionVersion,
                        }

                        onCreateUser({ user: authJsUser });
                        return authJsUser;

                        // Otherwise, the user exists, so verify the password.
                    } else {
                        if (!user.hashedPassword) {
                            return null;
                        }

                        if (!bcrypt.compareSync(password, user.hashedPassword)) {
                            return null;
                        }

                        return {
                            id: user.id,
                            email: user.email,
                            name: user.name ?? undefined,
                            image: user.image ?? undefined,
                            sessionVersion: user.sessionVersion,
                        };
                    }
                }
            }), purpose: "sso"
        });
    }

    return providers;
}

const nextAuthResult = NextAuth({
    secret: env.AUTH_SECRET,
    adapter: EncryptedPrismaAdapter(__unsafePrisma),
    session: {
        strategy: "jwt",
        maxAge: env.AUTH_SESSION_MAX_AGE_SECONDS,
        updateAge: env.AUTH_SESSION_UPDATE_AGE_SECONDS,
    },
    trustHost: true,
    events: {
        createUser: onCreateUser,
        signIn: async ({ user, account }) => {
            // Explicitly update the Account record with the OAuth token details.
            // This is necessary to update the access token when the user
            // re-authenticates.
            // NOTE: Tokens are encrypted before storage for security
            if (
                account &&
                account.provider &&
                account.provider !== 'credentials' &&
                account.providerAccountId
            ) {
                const issuerUrl = await getIssuerUrlForAccount(account);

                await __unsafePrisma.account.update({
                    where: {
                        provider_providerAccountId: {
                            provider: account.provider,
                            providerAccountId: account.providerAccountId,
                        },
                    },
                    data: encryptAccountData({
                        refresh_token: account.refresh_token,
                        access_token: account.access_token,
                        expires_at: account.expires_at,
                        token_type: account.token_type,
                        scope: account.scope,
                        id_token: account.id_token,
                        issuerUrl,
                        // Clear any token refresh error since the user has successfully re-authenticated.
                        tokenRefreshErrorMessage: null,
                    })
                })
            }

            if (user.id) {
                await auditService.createAudit({
                    action: "user.signed_in",
                    actor: {
                        id: user.id,
                        type: "user"
                    },
                    orgId: SINGLE_TENANT_ORG_ID, // TODO(mt)
                    target: {
                        id: user.id,
                        type: "user"
                    }
                });
            }
        },
        signOut: async (message) => {
            const token = message as { token: { userId: string } | null };
            if (token?.token?.userId) {
                await auditService.createAudit({
                    action: "user.signed_out",
                    actor: {
                        id: token.token.userId,
                        type: "user"
                    },
                    orgId: SINGLE_TENANT_ORG_ID, // TODO(mt)
                    target: {
                        id: token.token.userId,
                        type: "user"
                    }
                });
            }
        }
    },
    callbacks: {
        // Restrict post-auth redirects (sign-in / sign-out, `callbackUrl`,
        // `redirectTo`) to the same origin as the application. This mirrors
        // Auth.js's documented default; we set it explicitly so the protection
        // is visible in code and not dependent on upstream defaults.
        // @see https://authjs.dev/reference/core#redirect
        async redirect({ url, baseUrl }) {
            if (url.startsWith("/")) {
                return `${baseUrl}${url}`;
            }

            try {
                if (new URL(url).origin === baseUrl) {
                    return url;
                }
            } catch {
                // Malformed URL — fall through to baseUrl.
            }

            return baseUrl;
        },
        async jwt({ token, user: _user }) {
            const user = _user as User | undefined;
            // @note: `user` will be available on signUp or signIn triggers.
            // Cache the userId in the JWT for later use.
            if (user) {
                token.userId = user.id;
                token.sessionVersion = user.sessionVersion ?? 0;
            }

            // @note The following performs a lazy migration of the issuerUrl
            // in the user's accounts. The issuerUrl was introduced in v4.15.4
            // and will not be present for accounts created prior to this version.
            //
            // @see https://github.com/sourcebot-dev/sourcebot/pull/993
            if (token.userId) {
                const accountsWithoutIssuerUrl = await __unsafePrisma.account.findMany({
                    where: {
                        userId: token.userId,
                        issuerUrl: null,
                    },
                });

                for (const account of accountsWithoutIssuerUrl) {
                    const issuerUrl = await getIssuerUrlForAccount(account);
                    if (issuerUrl) {
                        await __unsafePrisma.account.update({
                            where: {
                                id: account.id,
                            },
                            data: {
                                issuerUrl,
                            },
                        });
                    }
                }
            }

            return token;
        },
        async session({ session, token }) {
            // @WARNING: Anything stored in the session will be sent over
            // to the client.
            session.user = {
                ...session.user,
                // Propagate the userId to the session.
                id: token.userId,
            }
            session.sessionVersion = token.sessionVersion;

            return session;
        },
    },
    providers: getProviders().map((provider) => provider.provider),
    pages: {
        signIn: "/login",
        // We set redirect to false in signInOptions so we can pass the email is as a param
        // verifyRequest: "/login/verify",
    }
});

export const { handlers, signIn, signOut } = nextAuthResult;

/**
 * Wrapped session resolver that enforces JWT versioning at the auth layer.
 *
 * Every JWT cookie carries the `sessionVersion` it was minted with. This
 * wrapper compares it against the user's current `sessionVersion` in the
 * database; if the user's version has been bumped (e.g., they were removed
 * from the org), we return null so every caller of `auth()` sees the
 * session as logged out.
 */
export const auth = cache(async (): Promise<Session | null> => {
    const session = await nextAuthResult.auth();
    if (!session) {
        return null;
    }

    const dbUser = await __unsafePrisma.user.findUnique({
        where: { id: session.user.id },
        select: { sessionVersion: true },
    });

    if (!dbUser) {
        return null;
    }

    const tokenVersion = session.sessionVersion ?? 0;
    if (tokenVersion !== dbUser.sessionVersion) {
        return null;
    }

    return session;
});

/**
 * Returns the issuer URL for a given auth.js account
 */
const getIssuerUrlForAccount = async (account: { provider: string; }) => {
    const providers = getProviders();
    const matchingProvider = providers.find((provider) => {
        if (typeof provider.provider === "function") {
            const providerInfo = provider.provider();
            return providerInfo.id === account.provider;
        } else {
            return provider.provider.id === account.provider;
        }
    });
    return matchingProvider?.issuerUrl;
}
