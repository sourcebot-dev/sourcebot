import { existsSync } from "fs";
import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";
import { isServiceError } from "@/lib/utils";
import { __unsafePrisma } from "@/prisma";
import {
    createLogger,
    decryptActivationCode,
    env,
    SOURCEBOT_VERSION,
    isValidOfflineLicenseActive,
    verifyOnlineLicenseAssertion,
} from "@sourcebot/shared";
import { client } from "./client";
import { ServicePingRequest } from "./types";
import { ServiceErrorException } from "@/lib/serviceError";
import { getConfiguredLanguageModels } from "@/features/chat/utils.server";
import { activeMembershipWhere } from "@/features/membership/utils";
import { getSystemInfo } from "./systemInfo";

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
        activeUserCount,
        dauCount,
        wauCount,
        mauCount,
        repoCount,
    ] = await Promise.all([
        __unsafePrisma.userToOrg.count({
            where: {
                orgId,
                ...activeMembershipWhere(),
            },
        }),
        __unsafePrisma.userToOrg.count({
            where: {
                orgId,
                ...activeMembershipWhere(),
                lastActiveAt: { gte: dauCutoff },
            },
        }),
        __unsafePrisma.userToOrg.count({
            where: {
                orgId,
                ...activeMembershipWhere(),
                lastActiveAt: { gte: wauCutoff },
            },
        }),
        __unsafePrisma.userToOrg.count({
            where: {
                orgId,
                ...activeMembershipWhere(),
                lastActiveAt: { gte: mauCutoff },
            },
        }),
        __unsafePrisma.repo.count({
            where: {
                orgId,
            },
        }),
    ]);

    const activationCode = license?.activationCode
        ? decryptActivationCode(license.activationCode)
        : undefined;

    const isLanguageModelConfigured = (await getConfiguredLanguageModels()).length > 0;

    // Best-effort — a failure to collect system info must never prevent the ping.
    const systemInfo = await getSystemInfo().catch((error) => {
        logger.warn(`Failed to collect system info for service ping: ${error}`);
        return undefined;
    });

    const payload: ServicePingRequest = {
        installId: env.SOURCEBOT_INSTALL_ID,
        version: SOURCEBOT_VERSION,
        hostname: env.AUTH_URL,
        userCount: activeUserCount,
        repoCount,
        dauCount,
        wauCount,
        mauCount,
        deploymentType: inferDeploymentType(),
        isTelemetryEnabled: env.SOURCEBOT_TELEMETRY_DISABLED === 'false',
        isLanguageModelConfigured,
        ...(systemInfo && { systemInfo }),
        ...(activationCode && { activationCode }),
    };

    await recordServicePingInDB(orgId, payload);

    if (isValidOfflineLicenseActive()) {
        logger.debug('Skipping service ping: active offline license detected.');
        return;
    }

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
        if (response.licenseAssertion && !verifyOnlineLicenseAssertion(response.licenseAssertion)) {
            // Never persist an assertion we cannot authenticate. In particular,
            // do not silently write only the legacy fields and create a
            // signature-downgrade path.
            throw new Error('Lighthouse returned an invalid online license assertion');
        }

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
                ...(response.licenseAssertion && { licenseAssertion: response.licenseAssertion }),
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

const recordServicePingInDB = async (orgId: number, payload: ServicePingRequest) => {
    // Strip the activation code before persisting.
    const { activationCode: _activationCode, ...sanitizedPayload } = payload;

    try {
        await __unsafePrisma.servicePingEvent.create({
            data: {
                orgId,
                payload: sanitizedPayload,
            },
        });
    } catch (error) {
        // Recording the ping is best-effort: a failure here must not prevent
        // the actual ping from being sent to Lighthouse.
        logger.error(`Failed to record service ping in database:\n ${error}`);
    }
};
