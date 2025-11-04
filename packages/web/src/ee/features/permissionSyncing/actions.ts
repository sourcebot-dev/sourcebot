'use server';

import { sew } from "@/actions";
import { createLogger } from "@sourcebot/logger";
import { withAuthV2, withMinimumOrgRole } from "@/withAuthV2";
import { loadConfig } from "@sourcebot/shared";
import { env } from "@/env.mjs";
import { OrgRole } from "@sourcebot/db";
import { cookies } from "next/headers";
import { OPTIONAL_PROVIDERS_LINK_SKIPPED_COOKIE_NAME } from "@/lib/constants";
import { IntegrationIdentityProviderState } from "@/ee/features/permissionSyncing/types";
import { auth } from "@/auth";

const logger = createLogger('web-ee-permission-syncing-actions');

export const getIntegrationProviderStates = async () => sew(() =>
    withAuthV2(async ({ prisma, role, user }) =>
        withMinimumOrgRole(role, OrgRole.MEMBER, async () => {
            const config = await loadConfig(env.CONFIG_PATH);
            const integrationProviderConfigs = config.identityProviders ?? [];
            const linkedAccounts = await prisma.account.findMany({
                where: {
                    userId: user.id,
                    provider: {
                        in: integrationProviderConfigs.map(p => p.provider)
                    }
                },
                select: {
                    provider: true,
                    providerAccountId: true
                }
            });

            // Fetch the session to get token errors
            const session = await auth();
            const providerErrors = session?.integrationProviderErrors;

            const integrationProviderState: IntegrationIdentityProviderState[] = [];
            for (const integrationProviderConfig of integrationProviderConfigs) {
                if (integrationProviderConfig.purpose === "integration") {
                    const linkedAccount = linkedAccounts.find(
                        account => account.provider === integrationProviderConfig.provider
                    );

                    const isLinked = !!linkedAccount;
                    const isRequired = integrationProviderConfig.required ?? true;
                    const providerError = providerErrors?.[integrationProviderConfig.provider];

                    integrationProviderState.push({
                        id: integrationProviderConfig.provider,
                        required: isRequired,
                        isLinked,
                        linkedAccountId: linkedAccount?.providerAccountId,
                        error: providerError
                    } as IntegrationIdentityProviderState);
                }
            }

            return integrationProviderState;
        })
    )
);


export const unlinkIntegrationProvider = async (provider: string) => sew(() =>
    withAuthV2(async ({ prisma, role, user }) =>
        withMinimumOrgRole(role, OrgRole.MEMBER, async () => {
            const config = await loadConfig(env.CONFIG_PATH);
            const identityProviders = config.identityProviders ?? [];

            const providerConfig = identityProviders.find(idp => idp.provider === provider)
            if (!providerConfig || !('purpose' in providerConfig) || providerConfig.purpose !== "integration") {
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

            // If we're unlinking a required identity provider then we want to wipe the optional skip cookie if it exists so that we give the
            // user the option of linking optional providers in the same link accounts screen
            const isRequired = providerConfig.required ?? true;
            if (isRequired) {
                const cookieStore = await cookies();
                cookieStore.delete(OPTIONAL_PROVIDERS_LINK_SKIPPED_COOKIE_NAME);
            }

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

