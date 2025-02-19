import 'next-auth/jwt';
import NextAuth, { DefaultSession } from "next-auth"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import EmailProvider from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/prisma";
import {
    AUTH_GITHUB_CLIENT_ID,
    AUTH_GITHUB_CLIENT_SECRET,
    AUTH_GOOGLE_CLIENT_ID,
    AUTH_GOOGLE_CLIENT_SECRET,
    AUTH_SECRET,
    AUTH_URL,
    AUTH_CREDENTIALS_LOGIN_ENABLED,
    EMAIL_FROM,
    SMTP_CONNECTION_URL
} from "./lib/environment";
import { User } from '@sourcebot/db';
import 'next-auth/jwt';
import type { Provider } from "next-auth/providers";
import { verifyCredentialsRequestSchema, verifyCredentialsResponseSchema } from './lib/schemas';
import { createTransport } from 'nodemailer';
import { render } from '@react-email/render';
import MagicLinkEmail from './emails/magicLink';

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

    if (AUTH_GITHUB_CLIENT_ID && AUTH_GITHUB_CLIENT_SECRET) {
        providers.push(GitHub({
            clientId: AUTH_GITHUB_CLIENT_ID,
            clientSecret: AUTH_GITHUB_CLIENT_SECRET,
        }));
    }

    if (AUTH_GOOGLE_CLIENT_ID && AUTH_GOOGLE_CLIENT_SECRET) {
        providers.push(Google({
            clientId: AUTH_GOOGLE_CLIENT_ID,
            clientSecret: AUTH_GOOGLE_CLIENT_SECRET,
        }));
    }

    if (SMTP_CONNECTION_URL && EMAIL_FROM) {
        providers.push(EmailProvider({
            server: SMTP_CONNECTION_URL,
            from: EMAIL_FROM,
            maxAge: 60 * 10,
            sendVerificationRequest: async ({ identifier, url, provider }) => {
                const transport = createTransport(provider.server);
                const html = await render(MagicLinkEmail({ magicLink: url, baseUrl: 'https://sourcebot.app' }));
                const result = await transport.sendMail({
                    to: identifier,
                    from: provider.from,
                    subject: 'Log in to Sourcebot',
                    html,
                    text: `Log in to Sourcebot by clicking here: ${url}`
                });

                const failed = result.rejected.concat(result.pending).filter(Boolean);
                if (failed.length) {
                    throw new Error(`Email(s) (${failed.join(", ")}) could not be sent`);
                }
            }
        }));
    }

    if (AUTH_CREDENTIALS_LOGIN_ENABLED) {
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
    
                // authorize runs in the edge runtime (where we cannot make DB calls / access environment variables),
                // so we need to make a request to the server to verify the credentials.
                const response = await fetch(new URL('/api/auth/verifyCredentials', AUTH_URL), {
                    method: 'POST',
                    body: JSON.stringify({ email, password }),
                });
    
                if (!response.ok) {
                    return null;
                }
    
                const user = verifyCredentialsResponseSchema.parse(await response.json());
                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    image: user.image,
                }
            }
        }));
    }

    return providers;
}

const useSecureCookies = AUTH_URL?.startsWith("https://") ?? false;
const hostName = AUTH_URL ? new URL(AUTH_URL).hostname : "localhost";

export const { handlers, signIn, signOut, auth } = NextAuth({
    secret: AUTH_SECRET,
    adapter: PrismaAdapter(prisma),
    session: {
        strategy: "jwt",
    },
    trustHost: true,
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
        verifyRequest: "/login/verify",
    }
});
