import 'next-auth/jwt';
import NextAuth, { User as AuthJsUser, DefaultSession } from "next-auth"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/prisma";
import type { Provider } from "next-auth/providers"
import { AUTH_GITHUB_CLIENT_ID, AUTH_GITHUB_CLIENT_SECRET, AUTH_GOOGLE_CLIENT_ID, AUTH_GOOGLE_CLIENT_SECRET, AUTH_SECRET } from "./lib/environment";
import { User } from '@sourcebot/db';
import { notAuthenticated, notFound, unexpectedError } from "@/lib/serviceError";
import { getUser } from "./data/user";
import { LuToggleRight } from 'react-icons/lu';

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
    GitHub({
        clientId: AUTH_GITHUB_CLIENT_ID,
        clientSecret: AUTH_GITHUB_CLIENT_SECRET,
    }),
    Google({
        clientId: AUTH_GOOGLE_CLIENT_ID!,
        clientSecret: AUTH_GOOGLE_CLIENT_SECRET!,
    })
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


export const { handlers, signIn, signOut, auth } = NextAuth({
    secret: AUTH_SECRET,
    adapter: PrismaAdapter(prisma),
    session: {
        strategy: "jwt",
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
        }
    },
    providers: providers,
    pages: {
        signIn: "/login"
    }
});

export const getCurrentUserOrg = async () => {
    const session = await auth();
    if (!session) {
        return notAuthenticated();
    }

    const user = await getUser(session.user.id);
    if (!user) {
        return unexpectedError("User not found");
    }
    const orgId = user.activeOrgId;
    if (!orgId) {
        return unexpectedError("User has no active org");
    }

    const membership = await prisma.userToOrg.findUnique({
        where: {
            orgId_userId: {
                userId: session.user.id,
                orgId,
            }
        },
    });
    if (!membership) {
        return notFound();
    }

    return orgId;
}

export const doesUserHaveOrg = async (userId: string) => {
    const orgs = await prisma.userToOrg.findMany({
        where: {
            userId,
        },
    });

    return orgs.length > 0;
}
