import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";
import { isServiceError } from "@/lib/utils";
import { __unsafePrisma } from "@/prisma";
import { createLogger, decryptActivationCode, env, SOURCEBOT_VERSION } from "@sourcebot/shared";
import { client } from "./client";
import { ServicePingRequest } from "./types";

const logger = createLogger('service-ping');

const SERVICE_PING_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 day

export const syncWithLighthouse = async (orgId: number) => {
    // Look up the activation code from the License record
    const license = await __unsafePrisma.license.findUnique({
        where: { orgId },
    });

    const userCount = await __unsafePrisma.userToOrg.count({
        where: {
            orgId,
        },
    });

    const activationCode = license?.activationCode
        ? decryptActivationCode(license.activationCode)
        : undefined;

    const payload: ServicePingRequest = {
        installId: env.SOURCEBOT_INSTALL_ID,
        version: SOURCEBOT_VERSION,
        userCount,
        ...(activationCode && { activationCode }),
    };

    const response = await client.ping(payload);
    if (isServiceError(response)) {
        logger.error(`Service ping failed:\n ${JSON.stringify(response, null, 2)}`)
        return;
    }

    logger.info(`Service ping sent successfully`);

    // If we have a license and Lighthouse returned license data, sync it
    if (license && response.license) {
        const {
            entitlements,
            seats,
            status,
            planName,
            unitAmount,
            currency,
            interval,
            intervalCount,
            nextRenewalAt,
            nextRenewalAmount,
            cancelAt,
            trialEnd,
            hasPaymentMethod,
        } = response.license;

        await __unsafePrisma.license.update({
            where: {
                orgId
            },
            data: {
                entitlements,
                seats,
                status,
                planName,
                unitAmount,
                currency,
                interval,
                intervalCount,
                nextRenewalAt: nextRenewalAt ? new Date(nextRenewalAt) : null,
                nextRenewalAmount,
                cancelAt: cancelAt ? new Date(cancelAt) : null,
                trialEnd: trialEnd ? new Date(trialEnd) : null,
                hasPaymentMethod,
                lastSyncAt: new Date(),
            },
        });

        if (trialEnd) {
            await __unsafePrisma.org.update({
                where: { id: orgId, trialUsedAt: null },
                data: { trialUsedAt: new Date() },
            }).catch(() => {
                // No-op: the `where` matched zero rows because trialUsedAt
                // was already set. Safe to ignore.
            });
        }

        logger.info(`License synced: entitlements=${entitlements.join(',')}, seats=${seats}, status=${status}`);
    }
};

export const startServicePingCronJob = () => {
    syncWithLighthouse(SINGLE_TENANT_ORG_ID);
    setInterval(
        () => syncWithLighthouse(SINGLE_TENANT_ORG_ID),
        SERVICE_PING_INTERVAL_MS
    );
};
