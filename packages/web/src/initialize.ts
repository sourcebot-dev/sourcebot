import { __unsafePrisma } from "@/prisma";
import { startServicePingCronJob } from '@/ee/features/lighthouse/servicePing';
import { createLogger, env } from "@sourcebot/shared";
import { hasEntitlement } from '@/lib/entitlements';
import { SINGLE_TENANT_ORG_ID } from './lib/constants';

const logger = createLogger('web-initialize');

const init = async () => {
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
