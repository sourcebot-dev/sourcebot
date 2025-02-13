import 'next-auth/jwt';
import NextAuth, { DefaultSession } from "next-auth"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/prisma";
import { AUTH_GITHUB_CLIENT_ID, AUTH_GITHUB_CLIENT_SECRET, AUTH_GOOGLE_CLIENT_ID, AUTH_GOOGLE_CLIENT_SECRET, AUTH_SECRET, AUTH_URL } from "./lib/environment";
import { User } from '@sourcebot/db';
import 'next-auth/jwt';
import type { Provider } from "next-auth/providers";

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

const providers: Provider[] = [
    ...(AUTH_GITHUB_CLIENT_ID && AUTH_GITHUB_CLIENT_SECRET ? [
        GitHub({
            clientId: AUTH_GITHUB_CLIENT_ID,
            clientSecret: AUTH_GITHUB_CLIENT_SECRET,
        }),
    ] : []),
    ...(AUTH_GOOGLE_CLIENT_ID && AUTH_GOOGLE_CLIENT_SECRET ? [
        Google({
            clientId: AUTH_GOOGLE_CLIENT_ID,
            clientSecret: AUTH_GOOGLE_CLIENT_SECRET,
        }),
    ] : []),
];

// @see: https://authjs.dev/guides/pages/signin
export const providerMap = providers
    .map((provider) => {
        if (typeof provider === "function") {
            const providerData = provider()
            return { id: providerData.id, name: providerData.name }
        } else {
            return { id: provider.id, name: provider.name }
        }
    })
    .filter((provider) => provider.id !== "credentials");


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
            name: `${useSecureCookies ? '__Host-' : ''}authjs.csrf-token`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: useSecureCookies,
                domain: `.${hostName}`
            }
        }
    },
    providers: providers,
    pages: {
        signIn: "/login"
    }
});
