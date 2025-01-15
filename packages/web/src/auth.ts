import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/prisma";
import type { Provider } from "next-auth/providers"

const providers: Provider[] = [
    GitHub,
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
    adapter: PrismaAdapter(prisma),
    session: {
        strategy: "jwt",
    },
    providers: providers,
    callbacks: {
        authorized: async ({ auth }) => {
            return !!auth
        },
    },
    pages: {
        signIn: "/login"
    }
})
