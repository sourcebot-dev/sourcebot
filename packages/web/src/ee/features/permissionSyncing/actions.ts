'use server';

import { sew } from "@/actions";
import { createLogger } from "@sourcebot/logger";
import { withAuthV2, withMinimumOrgRole } from "@/withAuthV2";
import { loadConfig } from "@sourcebot/shared";
import { env } from "@/env.mjs";
import { OrgRole } from "@sourcebot/db";
import { cookies } from "next/headers";
import { OPTIONAL_PROVIDERS_LINK_SKIPPED_COOKIE_NAME } from "@/lib/constants";

const logger = createLogger('web-ee-permission-syncing-actions');

export const userNeedsToLinkIdentityProvider = async () => sew(() =>
    withAuthV2(async ({ prisma, role, user }) =>
        withMinimumOrgRole(role, OrgRole.MEMBER, async () => {
            const config = await loadConfig(env.CONFIG_PATH);
            const identityProviders = config.identityProviders ?? [];

            for (const identityProvider of identityProviders) {
                if (identityProvider.purpose === "integration") {
                    // Only check required providers (default to true if not specified)
                    const isRequired = 'required' in identityProvider ? identityProvider.required : true;

                    if (!isRequired) {
                        continue;
                    }

                    const linkedAccount = await prisma.account.findFirst({
                        where: {
                            provider: identityProvider.provider,
                            userId: user.id,
                        },
                    });

                    if (!linkedAccount) {
                        logger.info(`Required integration identity provider ${identityProvider.provider} account info not found for user ${user.id}`);
                        return true;
                    }
                }
            }

            return false;
        })
    )
);

export const getUnlinkedIntegrationProviders = async () => sew(() =>
    withAuthV2(async ({ prisma, role, user }) =>
        withMinimumOrgRole(role, OrgRole.MEMBER, async () => {
            const config = await loadConfig(env.CONFIG_PATH);
            const identityProviders = config.identityProviders ?? [];
            const unlinkedProviders = [];

            for (const identityProvider of identityProviders) {
                if (identityProvider.purpose === "integration") {
                    const linkedAccount = await prisma.account.findFirst({
                        where: {
                            provider: identityProvider.provider,
                            userId: user.id,
                        },
                    });

                    if (!linkedAccount) {
                        const isRequired = 'required' in identityProvider ? identityProvider.required as boolean : true;
                        logger.info(`Integration identity provider ${identityProvider.provider} not linked for user ${user.id}`);
                        unlinkedProviders.push({
                            id: identityProvider.provider,
                            name: identityProvider.provider,
                            purpose: "integration" as const,
                            required: isRequired,
                        });
                    }
                }
            }

            return unlinkedProviders;
        })
    )
);

export const unlinkIntegrationProvider = async (provider: string) => sew(() =>
    withAuthV2(async ({ prisma, role, user }) =>
        withMinimumOrgRole(role, OrgRole.MEMBER, async () => {
            const config = await loadConfig(env.CONFIG_PATH);
            const identityProviders = config.identityProviders ?? [];

            // Verify this is an integration provider
            const isIntegrationProvider = identityProviders.some(
                idp => idp.provider === provider && idp.purpose === "integration"
            );

            if (!isIntegrationProvider) {
                throw new Error("Provider is not an integration provider");
            }

            // Delete the account
            const result = await prisma.account.deleteMany({
                where: {
                    provider,
                    userId: user.id,
                },
            });

            logger.info(`Unlinked integration provider ${provider} for user ${user.id}. Deleted ${result.count} account(s).`);

            return { success: true, count: result.count };
        })
    )
);

export const skipOptionalProvidersLink = async () => sew(async () => {
    const cookieStore = await cookies();
    cookieStore.set(OPTIONAL_PROVIDERS_LINK_SKIPPED_COOKIE_NAME, 'true', {
        httpOnly: false, // Allow client-side access
        maxAge: 365 * 24 * 60 * 60, // 1 year in seconds
    });
    return true;
});