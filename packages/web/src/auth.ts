import 'next-auth/jwt';
import NextAuth, { DefaultSession, User as AuthJsUser } from "next-auth"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import EmailProvider from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/prisma";
import { env } from "@/env.mjs";
import { OrgRole, User } from '@sourcebot/db';
import 'next-auth/jwt';
import type { Provider } from "next-auth/providers";
import { verifyCredentialsRequestSchema } from './lib/schemas';
import { createTransport } from 'nodemailer';
import { render } from '@react-email/render';
import MagicLinkEmail from './emails/magicLinkEmail';
import { SINGLE_TENANT_ORG_ID } from './lib/constants';
import bcrypt from 'bcrypt';

export const runtime = 'nodejs';

declare module 'next-auth' {
    interface Session {
        user: {
            id: string;
        } & DefaultSession['user'];
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        userId: string
    }
}

export const getProviders = () => {
    const providers: Provider[] = [];

    if (env.AUTH_GITHUB_CLIENT_ID && env.AUTH_GITHUB_CLIENT_SECRET) {
        providers.push(GitHub({
            clientId: env.AUTH_GITHUB_CLIENT_ID,
            clientSecret: env.AUTH_GITHUB_CLIENT_SECRET,
        }));
    }

    if (env.AUTH_GOOGLE_CLIENT_ID && env.AUTH_GOOGLE_CLIENT_SECRET) {
        providers.push(Google({
            clientId: env.AUTH_GOOGLE_CLIENT_ID,
            clientSecret: env.AUTH_GOOGLE_CLIENT_SECRET,
        }));
    }

    if (env.SMTP_CONNECTION_URL && env.EMAIL_FROM) {
        providers.push(EmailProvider({
            server: env.SMTP_CONNECTION_URL,
            from: env.EMAIL_FROM,
            maxAge: 60 * 10,
            generateVerificationToken: async () => {
                const token = String(Math.floor(100000 + Math.random() * 900000));
                return token;
            },
            sendVerificationRequest: async ({ identifier, provider, token }) => {
                const transport = createTransport(provider.server);
                const html = await render(MagicLinkEmail({ baseUrl: env.AUTH_URL, token: token }));
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
        }));
    }

    if (env.AUTH_CREDENTIALS_LOGIN_ENABLED === 'true') {
        providers.push(Credentials({
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
        }));
    }

    return providers;
}

const onCreateUser = async ({ user }: { user: AuthJsUser }) => {
    // In single-tenant mode w/ auth, we assign the first user to sign
    // up as the owner of the default org.
    if (
        env.SOURCEBOT_TENANCY_MODE === 'single' &&
        env.SOURCEBOT_AUTH_ENABLED === 'true'
    ) {
        await prisma.$transaction(async (tx) => {
            const defaultOrg = await tx.org.findUnique({
                where: {
                    id: SINGLE_TENANT_ORG_ID,
                },
                include: {
                    members: true,
                }
            });

            // Only the first user to sign up will be an owner of the default org.
            if (defaultOrg?.members.length === 0) {
                await tx.org.update({
                    where: {
                        id: SINGLE_TENANT_ORG_ID,
                    },
                    data: {
                        members: {
                            create: {
                                role: OrgRole.OWNER,
                                user: {
                                    connect: {
                                        id: user.id,
                                    }
                                }
                            }
                        }
                    }
                });
            }
        });
    }
}

const useSecureCookies = env.AUTH_URL?.startsWith("https://") ?? false;
const hostName = env.AUTH_URL ? new URL(env.AUTH_URL).hostname : "localhost";

export const { handlers, signIn, signOut, auth } = NextAuth({
    secret: env.AUTH_SECRET,
    adapter: PrismaAdapter(prisma),
    session: {
        strategy: "jwt",
    },
    trustHost: true,
    events: {
        createUser: onCreateUser,
    },
    callbacks: {
        async jwt({ token, user: _user }) {
            const user = _user as User | undefined;
            // @note: `user` will be available on signUp or signIn triggers.
            // Cache the userId in the JWT for later use.
            if (user) {
                token.userId = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            // @WARNING: Anything stored in the session will be sent over
            // to the client.
            session.user = {
                ...session.user,
                // Propogate the userId to the session.
                id: token.userId,
            }
            return session;
        },
    },
    cookies: {
        sessionToken: {
            name: `${useSecureCookies ? '__Secure-' : ''}authjs.session-token`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: useSecureCookies,
                domain: `.${hostName}`
            }
        },
        callbackUrl: {
            name: `${useSecureCookies ? '__Secure-' : ''}authjs.callback-url`,
            options: {
                sameSite: 'lax',
                path: '/',
                secure: useSecureCookies,
                domain: `.${hostName}`
            }
        },
        csrfToken: {
            name: `${useSecureCookies ? '__Secure-' : ''}authjs.csrf-token`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: useSecureCookies,
                domain: `.${hostName}`
            }
        }
    },
    providers: getProviders(),
    pages: {
        signIn: "/login",
        // We set redirect to false in signInOptions so we can pass the email is as a param
        // verifyRequest: "/login/verify",
    }
});
