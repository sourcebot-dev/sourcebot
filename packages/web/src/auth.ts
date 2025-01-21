import NextAuth, { User as AuthJsUser, DefaultSession } from "next-auth"
import GitHub from "next-auth/providers/github"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/prisma";
import type { Provider } from "next-auth/providers"
import { AUTH_GITHUB_CLIENT_ID, AUTH_GITHUB_CLIENT_SECRET, AUTH_SECRET } from "./lib/environment";

declare module 'next-auth' {
    interface Session {
      user: {
        id: string;
      } & DefaultSession['user'];
    }
  }

const providers: Provider[] = [
    GitHub({
        clientId: AUTH_GITHUB_CLIENT_ID,
        clientSecret: AUTH_GITHUB_CLIENT_SECRET,
    }),
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

const onCreateUser = async ({ user }: { user: AuthJsUser }) => {
        if (!user.id) {
            throw new Error("User ID is required.");
        }
    
        const orgName = (() => {
            if (user.name) {
                return `${user.name}'s Org`;
            } else {
                return `Default Org`;
            }
        })();

        await prisma.$transaction((async (tx) => {
            const org = await tx.org.create({
                data: {
                    name: orgName,
                    members: {
                        create: {
                            role: "OWNER",
                            user: {
                                connect: {
                                    id: user.id,
                                }
                            }
                        }
                    }
                }
            });

            await tx.user.update({
                where: {
                    id: user.id,
                },
                data: {
                    activeOrgId: org.id,
                }
            });
        }));
    }

export const { handlers, signIn, signOut, auth } = NextAuth({
    secret: AUTH_SECRET,
    adapter: PrismaAdapter(prisma),
    session: {
        strategy: "jwt",
    },
    events: {
        createUser: onCreateUser,
    },
    callbacks: {
        async session({ session, token }) {
            session.user = {
                ...session.user,
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                id: token.sub,
            }
            return session;
        }
    },
    providers: providers,
    pages: {
        signIn: "/login"
    }
});
