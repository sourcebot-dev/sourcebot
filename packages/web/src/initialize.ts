import { __unsafePrisma } from "@/prisma";
import { startServicePingCronJob, syncWithLighthouse } from '@/features/billing/servicePing';
import { startChangelogPollingJob } from '@/features/changelog/pollChangelog';
import { createLogger, env } from "@sourcebot/shared";
import { SINGLE_TENANT_ORG_ID } from './lib/constants';
import { warmModelCapabilitiesCatalog } from '@/features/chat/utils.server';
import * as Sentry from '@sentry/nextjs';

const logger = createLogger('web-initialize');

const syncDeprecatedEnvVars = async () => {
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

    // Sync credentials (email + password) login setting from the (deprecated) env var (only if explicitly set)
    if (env.AUTH_CREDENTIALS_LOGIN_ENABLED !== undefined) {
        const isCredentialsLoginEnabled = env.AUTH_CREDENTIALS_LOGIN_ENABLED === 'true';
        const org = await __unsafePrisma.org.findUnique({ where: { id: SINGLE_TENANT_ORG_ID } });
        if (org && org.isCredentialsLoginEnabled !== isCredentialsLoginEnabled) {
            await __unsafePrisma.org.update({
                where: { id: org.id },
                data: { isCredentialsLoginEnabled },
            });
            logger.info(`Credentials login set to ${isCredentialsLoginEnabled} via AUTH_CREDENTIALS_LOGIN_ENABLED environment variable`);
        }
    }

    // Sync email code login setting from the (deprecated) env var (only if explicitly set)
    if (env.AUTH_EMAIL_CODE_LOGIN_ENABLED !== undefined) {
        const isEmailCodeLoginEnabled = env.AUTH_EMAIL_CODE_LOGIN_ENABLED === 'true';
        const org = await __unsafePrisma.org.findUnique({ where: { id: SINGLE_TENANT_ORG_ID } });
        if (org && org.isEmailCodeLoginEnabled !== isEmailCodeLoginEnabled) {
            await __unsafePrisma.org.update({
                where: { id: org.id },
                data: { isEmailCodeLoginEnabled },
            });
            logger.info(`Email code login set to ${isEmailCodeLoginEnabled} via AUTH_EMAIL_CODE_LOGIN_ENABLED environment variable`);
        }
    }

    // Sync anonymous access setting from the (deprecated) env var (only if explicitly set)
    if (env.FORCE_ENABLE_ANONYMOUS_ACCESS !== undefined) {
        const isAnonymousAccessEnabled = env.FORCE_ENABLE_ANONYMOUS_ACCESS === 'true';
        const org = await __unsafePrisma.org.findUnique({ where: { id: SINGLE_TENANT_ORG_ID } });
        if (org && org.isAnonymousAccessEnabled !== isAnonymousAccessEnabled) {
            await __unsafePrisma.org.update({
                where: { id: org.id },
                data: { isAnonymousAccessEnabled },
            });
            logger.info(`Anonymous access set to ${isAnonymousAccessEnabled} via FORCE_ENABLE_ANONYMOUS_ACCESS environment variable`);
        }
    }
}

export const initialize = async (): Promise<void> => {
    await syncDeprecatedEnvVars();

    try {
        await syncWithLighthouse(SINGLE_TENANT_ORG_ID);
    } catch (error) {
        logger.error(`Startup Lighthouse sync failed: ${error instanceof Error ? error.message : String(error)}`);
        Sentry.captureException(error);
    }

    startServicePingCronJob();
    startChangelogPollingJob();
    warmModelCapabilitiesCatalog();
};
