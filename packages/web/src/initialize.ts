import { createGuestUser } from '@/lib/authUtils';
import { __unsafePrisma } from "@/prisma";
import { startServicePingCronJob } from '@/ee/features/lighthouse/servicePing';
import { OrgRole } from '@sourcebot/db';
import { createLogger, env, loadConfig } from "@sourcebot/shared";
import { hasEntitlement } from '@/lib/entitlements';
import { SINGLE_TENANT_ORG_ID, SOURCEBOT_GUEST_USER_ID } from './lib/constants';
import { ServiceErrorException } from './lib/serviceError';
import { getOrgMetadata, isServiceError } from './lib/utils';

const logger = createLogger('web-initialize');

const pruneOldGuestUser = async () => {
    // The old guest user doesn't have the GUEST role
    const guestUser = await __unsafePrisma.userToOrg.findUnique({
        where: {
            orgId_userId: {
                orgId: SINGLE_TENANT_ORG_ID,
                userId: SOURCEBOT_GUEST_USER_ID,
            },
            role: {
                not: OrgRole.GUEST,
            }
        },
    });

    if (guestUser) {
        await __unsafePrisma.user.delete({
            where: {
                id: guestUser.userId,
            },
        });

        logger.info(`Deleted old guest user ${guestUser.userId}`);
    }
}

const init = async () => {
    // This is needed because v4 introduces the GUEST org role as well as making authentication required. 
    // To keep things simple, we'll just delete the old guest user if it exists in the DB
    await pruneOldGuestUser();

    const hasAnonymousAccessEntitlement = await hasEntitlement("anonymous-access");
    if (hasAnonymousAccessEntitlement) {
        const res = await createGuestUser();
        if (isServiceError(res)) {
            throw new ServiceErrorException(res);
        }
    } else {
        // If anonymous access entitlement is not enabled, set the flag to false in the org on init
        const org = await __unsafePrisma.org.findUnique({ where: { id: SINGLE_TENANT_ORG_ID } });
        if (org) {
            const currentMetadata = getOrgMetadata(org);
            const mergedMetadata = {
                ...(currentMetadata ?? {}),
                anonymousAccessEnabled: false,
            };
            await __unsafePrisma.org.update({
                where: { id: org.id },
                data: { metadata: mergedMetadata },
            });
        }
    }

    // If we don't have the search context entitlement then wipe any existing
    // search contexts that may be present in the DB. This could happen if a deployment had
    // the entitlement, synced search contexts, and then no longer had the entitlement
    const hasSearchContextEntitlement = await hasEntitlement("search-contexts")
    if (!hasSearchContextEntitlement) {
        await __unsafePrisma.searchContext.deleteMany({
            where: {
                orgId: SINGLE_TENANT_ORG_ID,
            },
        });
    }

    // Sync anonymous access config from the config file
    const config = await loadConfig(env.CONFIG_PATH);
    const forceEnableAnonymousAccess = config.settings?.enablePublicAccess ?? env.FORCE_ENABLE_ANONYMOUS_ACCESS === 'true';

    if (forceEnableAnonymousAccess) {
        if (!hasAnonymousAccessEntitlement) {
            logger.warn(`FORCE_ENABLE_ANONYMOUS_ACCESS env var is set to true but anonymous access entitlement is not available. Setting will be ignored.`);
        } else {
            const org = await __unsafePrisma.org.findUnique({ where: { id: SINGLE_TENANT_ORG_ID } });
            if (org) {
                const currentMetadata = getOrgMetadata(org);
                const mergedMetadata = {
                    ...(currentMetadata ?? {}),
                    anonymousAccessEnabled: true,
                };

                await __unsafePrisma.org.update({
                    where: { id: org.id },
                    data: {
                        metadata: mergedMetadata,
                    },
                });
                logger.info(`Anonymous access enabled via FORCE_ENABLE_ANONYMOUS_ACCESS environment variable`);
            }
        }
    }

    // Sync member approval setting from env var (only if explicitly set)
    if (env.REQUIRE_APPROVAL_NEW_MEMBERS !== undefined) {
        const requireApprovalNewMembers = env.REQUIRE_APPROVAL_NEW_MEMBERS === 'true';
        const org = await __unsafePrisma.org.findUnique({ where: { id: SINGLE_TENANT_ORG_ID } });
        if (org && org.memberApprovalRequired !== requireApprovalNewMembers) {
            await __unsafePrisma.org.update({
                where: { id: org.id },
                data: { memberApprovalRequired: requireApprovalNewMembers },
            });
            logger.info(`Member approval requirement set to ${requireApprovalNewMembers} via REQUIRE_APPROVAL_NEW_MEMBERS environment variable`);
        }
    }
}

(async () => {
    await init();
    startServicePingCronJob();
})();
