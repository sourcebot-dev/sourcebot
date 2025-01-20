import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/prisma";
import type { Provider } from "next-auth/providers"
import { AUTH_GITHUB_CLIENT_ID, AUTH_GITHUB_CLIENT_SECRET, AUTH_SECRET } from "./lib/environment";

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


export const { handlers, signIn, signOut, auth } = NextAuth({
    secret: AUTH_SECRET,
    adapter: PrismaAdapter(prisma),
    session: {
        strategy: "jwt",
    },
    events: {
        // create a new organization when a user is created
        createUser: async ({ user }) => {
            if (!user.id) {
                throw new Error("User ID is required");
            }

            const orgName = (() => {
                if (user.name) {
                    return `${user.name}'s Org`;
                } else {
                    return `Default Org`;
                }
            })();

            await prisma.org.create({
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
        }
    },
    providers: providers,
    pages: {
        signIn: "/login"
    }
})
