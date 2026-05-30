import { existsSync } from "fs";
import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";
import { isServiceError } from "@/lib/utils";
import { __unsafePrisma } from "@/prisma";
import { createLogger, decryptActivationCode, env, SOURCEBOT_VERSION } from "@sourcebot/shared";
import { client } from "./client";
import { ServicePingRequest } from "./types";
import { ServiceErrorException } from "@/lib/serviceError";

const logger = createLogger('service-ping');

const SERVICE_PING_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 day


export const syncWithLighthouse = async (orgId: number) => {
    // Look up the activation code from the License record
    const license = await __unsafePrisma.license.findUnique({
        where: { orgId },
    });

    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const dauCutoff = new Date(now - 1 * DAY_MS);
    const wauCutoff = new Date(now - 7 * DAY_MS);
    const mauCutoff = new Date(now - 30 * DAY_MS);

    const [
        userCount,
        repoCount,
        dauCount,
        wauCount,
        mauCount,
    ] = await Promise.all([
        __unsafePrisma.userToOrg.count({
            where: {
                orgId,
            },
        }),
        __unsafePrisma.repo.count({
            where: {
                orgId,
            },
        }),
        __unsafePrisma.user.count({
            where: {
                orgs: { some: { orgId } },
                lastActiveAt: { gte: dauCutoff },
            },
        }),
        __unsafePrisma.user.count({
            where: {
                orgs: { some: { orgId } },
                lastActiveAt: { gte: wauCutoff },
            },
        }),
        __unsafePrisma.user.count({
            where: {
                orgs: { some: { orgId } },
                lastActiveAt: { gte: mauCutoff },
            },
        }),
    ]);

    const activationCode = license?.activationCode
        ? decryptActivationCode(license.activationCode)
        : undefined;

    const payload: ServicePingRequest = {
        installId: env.SOURCEBOT_INSTALL_ID,
        version: SOURCEBOT_VERSION,
        hostname: env.AUTH_URL,
        userCount,
        repoCount,
        dauCount,
        wauCount,
        mauCount,
        deploymentType: inferDeploymentType(),
        isTelemetryEnabled: env.SOURCEBOT_TELEMETRY_DISABLED === 'false',
        ...(activationCode && { activationCode }),
    };

    const response = await client.ping(payload);
    if (isServiceError(response)) {
        logger.error(`Service ping failed:\n ${JSON.stringify(response, null, 2)}`)

        if (license) {
            await __unsafePrisma.license.update({
                where: { orgId },
                data: { lastSyncErrorCode: response.errorCode },
            });
        }

        throw new ServiceErrorException(response);
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
            yearlyTermStatus,
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
                yearlyTermStartedAt: yearlyTermStatus ? new Date(yearlyTermStatus.termStartedAt) : null,
                yearlyTermEndsAt: yearlyTermStatus ? new Date(yearlyTermStatus.termEndsAt) : null,
                yearlyTotalQuartersInTerm: yearlyTermStatus?.totalQuartersInTerm ?? null,
                yearlyCurrentQuarterNumber: yearlyTermStatus?.currentQuarterNumber ?? null,
                yearlyCurrentQuarterStartedAt: yearlyTermStatus ? new Date(yearlyTermStatus.currentQuarterStartedAt) : null,
                yearlyCurrentQuarterEndsAt: yearlyTermStatus ? new Date(yearlyTermStatus.currentQuarterEndsAt) : null,
                yearlyCommittedSeats: yearlyTermStatus?.committedSeats ?? null,
                yearlyOverageSeats: yearlyTermStatus?.overageSeats ?? null,
                yearlyBillableOverageSeats: yearlyTermStatus?.billableOverageSeats ?? null,
                yearlyPeakSeats: yearlyTermStatus?.peakSeats ?? null,
                lastSyncAt: new Date(),
                lastSyncErrorCode: null,
            },
        });

        logger.info(`License synced: entitlements=${entitlements.join(',')}, seats=${seats}, status=${status}`);
    }
};

export const startServicePingCronJob = () => {
    syncWithLighthouse(SINGLE_TENANT_ORG_ID).catch(() => { /* ignore error */ })
    setInterval(
        () => syncWithLighthouse(SINGLE_TENANT_ORG_ID).catch(() => { /* ignore error */ }),
        SERVICE_PING_INTERVAL_MS
    );
};

const inferDeploymentType = (): string => {
    if (process.env.KUBERNETES_SERVICE_HOST) {
        return 'kubernetes';
    }
    if (existsSync('/.dockerenv')) {
        return 'docker';
    }
    return 'other';
};
