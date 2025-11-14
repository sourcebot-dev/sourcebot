import { createGuestUser } from '@/lib/authUtils';
import { SOURCEBOT_SUPPORT_EMAIL } from "@/lib/constants";
import { prisma } from "@/prisma";
import { OrgRole } from '@sourcebot/db';
import { createLogger, env, hasEntitlement, loadConfig } from "@sourcebot/shared";
import { getOrgFromDomain } from './data/org';
import { SINGLE_TENANT_ORG_DOMAIN, SINGLE_TENANT_ORG_ID, SOURCEBOT_GUEST_USER_ID } from './lib/constants';
import { ServiceErrorException } from './lib/serviceError';
import { getOrgMetadata, isServiceError } from './lib/utils';
import { clearSearchContexts } from './actions';

const logger = createLogger('web-initialize');

const pruneOldGuestUser = async () => {
    // The old guest user doesn't have the GUEST role
    const guestUser = await prisma.userToOrg.findUnique({
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
        await prisma.user.delete({
            where: {
                id: guestUser.userId,
            },
        });

        logger.info(`Deleted old guest user ${guestUser.userId}`);
    }
}

const initSingleTenancy = async () => {
    // This is needed because v4 introduces the GUEST org role as well as making authentication required. 
    // To keep things simple, we'll just delete the old guest user if it exists in the DB
    await pruneOldGuestUser();

    const hasAnonymousAccessEntitlement = hasEntitlement("anonymous-access");
    if (hasAnonymousAccessEntitlement) {
        const res = await createGuestUser(SINGLE_TENANT_ORG_DOMAIN);
        if (isServiceError(res)) {
            throw new ServiceErrorException(res);
        }
    } else {
        // If anonymous access entitlement is not enabled, set the flag to false in the org on init
        const org = await getOrgFromDomain(SINGLE_TENANT_ORG_DOMAIN);
        if (org) {
            const currentMetadata = getOrgMetadata(org);
            const mergedMetadata = {
                ...(currentMetadata ?? {}),
                anonymousAccessEnabled: false,
            };
            await prisma.org.update({
                where: { id: org.id },
                data: { metadata: mergedMetadata },
            });
        }
    }

    // If we don't have the search context entitlement then wipe any existing
    // search contexts that may be present in the DB. This could happen if a deployment had
    // the entitlement, synced search contexts, and then no longer had the entitlement
    const hasSearchContextEntitlement = hasEntitlement("search-contexts")
    if(!hasSearchContextEntitlement) {
        await prisma.searchContext.deleteMany({
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
            const org = await getOrgFromDomain(SINGLE_TENANT_ORG_DOMAIN);
            if (org) {
                const currentMetadata = getOrgMetadata(org);
                const mergedMetadata = {
                    ...(currentMetadata ?? {}),
                    anonymousAccessEnabled: true,
                };

                await prisma.org.update({
                    where: { id: org.id },
                    data: {
                        metadata: mergedMetadata,
                    },
                });
                logger.info(`Anonymous access enabled via FORCE_ENABLE_ANONYMOUS_ACCESS environment variable`);
            }
        }
    }
}

const initMultiTenancy = async () => {
    const hasMultiTenancyEntitlement = hasEntitlement("multi-tenancy");
    if (!hasMultiTenancyEntitlement) {
        logger.error(`SOURCEBOT_TENANCY_MODE is set to ${env.SOURCEBOT_TENANCY_MODE} but your license doesn't have multi-tenancy entitlement. Please contact ${SOURCEBOT_SUPPORT_EMAIL} to request a license upgrade.`);
        process.exit(1);
    }
}

(async () => {
    if (env.SOURCEBOT_TENANCY_MODE === 'single') {
        await initSingleTenancy();
    } else if (env.SOURCEBOT_TENANCY_MODE === 'multi') {
        await initMultiTenancy();
    } else {
        throw new Error(`Invalid SOURCEBOT_TENANCY_MODE: ${env.SOURCEBOT_TENANCY_MODE}`);
    }
})();
