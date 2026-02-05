import 'next-auth/jwt';
import NextAuth, { DefaultSession, User as AuthJsUser } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import EmailProvider from "next-auth/providers/nodemailer";
import { prisma } from "@/prisma";
import { env } from "@sourcebot/shared";
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
import { refreshLinkedAccountTokens, LinkedAccountErrors } from '@/ee/features/permissionSyncing/tokenRefresh';
import { EncryptedPrismaAdapter, encryptAccountData } from '@/lib/encryptedPrismaAdapter';

const auditService = getAuditService();
const eeIdentityProviders = hasEntitlement("sso") ? await getEEIdentityProviders() : [];

export const runtime = 'nodejs';

export type IdentityProvider = {
    provider: Provider;
    purpose: "sso" | "account_linking";
    required?: boolean;
}

declare module 'next-auth' {
    interface Session {
        user: {
            id: string;
        } & DefaultSession['user'];
        linkedAccountProviderErrors?: LinkedAccountErrors;
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        userId: string;
        linkedAccountErrors?: LinkedAccountErrors;
    }
}

export const getProviders = () => {
    const providers: IdentityProvider[] = eeIdentityProviders;

    if (env.SMTP_CONNECTION_URL && env.EMAIL_FROM_ADDRESS && env.AUTH_EMAIL_CODE_LOGIN_ENABLED === 'true') {
        providers.push({
            provider: EmailProvider({
                server: env.SMTP_CONNECTION_URL,
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

                    const user = await prisma.user.findUnique({
                        where: { email }
                    });

                    // The user doesn't exist, so create a new one.
                    if (!user) {
                        const hashedPassword = bcrypt.hashSync(password, 10);
                        const newUser = await prisma.user.create({
                            data: {
                                email,
                                hashedPassword,
                            }
                        });

                        const authJsUser: AuthJsUser = {
                            id: newUser.id,
                            email: newUser.email,
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
                        };
                    }
                }
            }), purpose: "sso"
        });
    }

    return providers;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    secret: env.AUTH_SECRET,
    adapter: EncryptedPrismaAdapter(prisma),
    session: {
        strategy: "jwt",
    },
    trustHost: true,
    events: {
        createUser: onCreateUser,
        signIn: async ({ user, account }) => {
            // Explicitly update the Account record with the OAuth token details.
            // This is necessary to update the access token when the user
            // re-authenticates.
            // NOTE: Tokens are encrypted before storage for security
            if (account && account.provider && account.provider !== 'credentials' && account.providerAccountId) {
                await prisma.account.update({
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
        async jwt({ token, user: _user }) {
            const user = _user as User | undefined;
            // @note: `user` will be available on signUp or signIn triggers.
            // Cache the userId in the JWT for later use.
            if (user) {
                token.userId = user.id;
            }

            // Refresh expiring tokens and capture any errors.
            if (hasEntitlement('permission-syncing') && token.userId) {
                const errors = await refreshLinkedAccountTokens(token.userId);
                token.linkedAccountErrors = Object.keys(errors).length > 0 ? errors : undefined;
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

            // Pass linked account errors to the session for UI display
            if (token.linkedAccountErrors) {
                session.linkedAccountProviderErrors = token.linkedAccountErrors;
            }

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
