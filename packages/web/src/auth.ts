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
                // Bump sessionVersion so any JWT minted before this signout
                // is treated as invalid by the jwt callback's DB cross-check
                // on its next request, even if the cookie value was captured
                // and is being replayed.
                await __unsafePrisma.user.update({
                    where: { id: token.token.userId },
                    data: { sessionVersion: { increment: 1 } },
                });

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
        async signIn({ account }) {
            const matchingProvider = account
                ? getProviders().find((p) => {
                    // NextAuth/Auth.js provider factories (e.g. Bitbucket,
                    // GitHub, GitLab) hardcode a default `id` at the top of
                    // the returned object and nest the caller's options
                    // (including any `id` override) under `.options`. At
                    // runtime the framework merges options over the
                    // top-level defaults, so the effective provider id can
                    // live under either field depending on whether the
                    // caller passed an override. Read `.options.id` first
                    // and fall back to the top-level `id`.
                    const config = (
                        typeof p.provider === 'function'
                            ? (p.provider as unknown as () => unknown)()
                            : p.provider
                    ) as { id?: string; options?: { id?: string } };
                    const providerId = config.options?.id ?? config.id;
                    return providerId === account.provider;
                })
                : undefined;

            // Refuse OAuth signin for providers configured purely for account
            // linking when no authenticated user is present on the request.
            //
            // Background: @auth/core's handleLoginOrRegister (callback/handle-login.js)
            // reads the session token from the request and, if it can't decode it
            // (e.g., the session cookie expired browser-side mid auth flow, or it
            // never made it across the cross-site redirect),
            // falls through to `createUser({ ...profile })`, silently spawning a
            // new orphan User row from the OAuth profile. That's correct behavior
            // for `purpose: "sso"` providers (an unauthenticated user logging in
            // via SSO should become a new Sourcebot user). It's wrong for
            // `purpose: "account_linking"` providers: by definition, those should
            // only ever attach an upstream identity to an *existing* signed-in
            // user, never mint a new Sourcebot user.
            //
            // Returning `false` here short-circuits the callback action with an
            // `AccessDenied` before handleLoginOrRegister can run, redirecting
            // the user to the error page instead of leaving them stranded as a
            // new orphan identity with no UserToOrg row.
            const isAccountLinkingAttempt = matchingProvider?.purpose === 'account_linking';
            const session = await auth();

            if (isAccountLinkingAttempt && session === null) {
                return false;
            }

            return true;
        },
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

            if (token.userId) {
                // Single query: fetch the user's current sessionVersion for
                // the cross-check below, plus any accounts that still need
                // the issuerUrl lazy migration.
                //
                // @see https://github.com/sourcebot-dev/sourcebot/pull/993
                const dbUser = await __unsafePrisma.user.findUnique({
                    where: {
                        id: token.userId as string,
                    },
                    select: {
                        sessionVersion: true,
                        accounts: {
                            where: {
                                issuerUrl: null,
                            },
                        },
                    },
                });

                // The user row was removed (e.g., deleted via /api/ee/user
                // or org-removal cascade). Treat the JWT as invalid so
                // /api/auth/session reports logged-out and @auth/core clears
                // the cookie from the browser.
                if (!dbUser) {
                    return null;
                }

                // On every non-login request, cross-check the JWT's
                // sessionVersion against the user's current sessionVersion in
                // the database. A mismatch means the user signed out, was
                // removed from the org, or their sessions were otherwise
                // invalidated since the JWT was minted. Returning null here
                // is what makes invalidation visible at /api/auth/session,
                // not just at withAuth-gated endpoints.
                const tokenSessionVersion = token.sessionVersion ?? 0;
                if (!user && tokenSessionVersion !== dbUser.sessionVersion) {
                    return null;
                }

                // Lazy migration of issuerUrl on accounts created before
                // the column was introduced in v4.15.4. The where clause
                // above scopes this to only accounts that still need it,
                // so the loop is a no-op once everyone is backfilled.
                for (const account of dbUser.accounts) {
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
 * Per-request memoized session resolver.
 *
 * JWT validity (including the `sessionVersion` cross-check against the
 * database and the existence of the underlying `User` row) is enforced in
 * the `jwt` callback above. If that callback returns `null`, NextAuth's
 * core resolves the session to `null` here and also clears the cookie on
 * the response. We therefore only need to memoize the result within a
 * single request so that multiple `auth()` callers share the same answer
 * without re-running the upstream resolver.
 */
export const auth = cache(async (): Promise<Session | null> => {
    return nextAuthResult.auth();
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
