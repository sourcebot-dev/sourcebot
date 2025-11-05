'use server';

import { sew } from "@/actions";
import { createLogger, env } from "@sourcebot/shared";
import { withAuthV2, withMinimumOrgRole } from "@/withAuthV2";
import { loadConfig } from "@sourcebot/shared";
import { OrgRole } from "@sourcebot/db";
import { cookies } from "next/headers";
import { OPTIONAL_PROVIDERS_LINK_SKIPPED_COOKIE_NAME } from "@/lib/constants";
import { LinkedAccountProviderState } from "@/ee/features/permissionSyncing/types";
import { auth } from "@/auth";

const logger = createLogger('web-ee-permission-syncing-actions');

export const getLinkedAccountProviderStates = async () => sew(() =>
    withAuthV2(async ({ prisma, role, user }) =>
        withMinimumOrgRole(role, OrgRole.MEMBER, async () => {
            const config = await loadConfig(env.CONFIG_PATH);
            const linkedAccountProviderConfigs = config.identityProviders ?? [];
            const linkedAccounts = await prisma.account.findMany({
                where: {
                    userId: user.id,
                    provider: {
                        in: linkedAccountProviderConfigs.map(p => p.provider)
                    }
                },
                select: {
                    provider: true,
                    providerAccountId: true
                }
            });

            // Fetch the session to get token errors
            const session = await auth();
            const providerErrors = session?.linkedAccountProviderErrors;

            const linkedAccountProviderState: LinkedAccountProviderState[] = [];
            for (const linkedAccountProviderConfig of linkedAccountProviderConfigs) {
                if (linkedAccountProviderConfig.purpose === "account_linking") {
                    const linkedAccount = linkedAccounts.find(
                        account => account.provider === linkedAccountProviderConfig.provider
                    );

                    const isLinked = !!linkedAccount;
                    const isRequired = linkedAccountProviderConfig.accountLinkingRequired ?? false;
                    const providerError = linkedAccount ? providerErrors?.[linkedAccount.providerAccountId] : undefined;

                    linkedAccountProviderState.push({
                        id: linkedAccountProviderConfig.provider,
                        required: isRequired,
                        isLinked,
                        linkedAccountId: linkedAccount?.providerAccountId,
                        error: providerError
                    } as LinkedAccountProviderState);
                }
            }

            return linkedAccountProviderState;
        })
    )
);


export const unlinkLinkedAccountProvider = async (provider: string) => sew(() =>
    withAuthV2(async ({ prisma, role, user }) =>
        withMinimumOrgRole(role, OrgRole.MEMBER, async () => {
            const config = await loadConfig(env.CONFIG_PATH);
            const identityProviders = config.identityProviders ?? [];

            const providerConfig = identityProviders.find(idp => idp.provider === provider)
            if (!providerConfig || providerConfig.purpose !== "account_linking") {
                throw new Error("Provider is not a linked account provider");
            }

            // Delete the account
            const result = await prisma.account.deleteMany({
                where: {
                    provider,
                    userId: user.id,
                },
            });

            logger.info(`Unlinked account provider ${provider} for user ${user.id}. Deleted ${result.count} account(s).`);

            // If we're unlinking a required identity provider then we want to wipe the optional skip cookie if it exists so that we give the
            // user the option of linking optional providers in the same link accounts screen
            const isRequired = providerConfig.accountLinkingRequired ?? false;
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

