import { env } from "@/env.mjs"
import { Entitlement, entitlementsByPlan, Plan } from "./constants"
import { base64Decode } from "@/lib/utils";
import { z } from "zod";
import { SOURCEBOT_SUPPORT_EMAIL } from "@/lib/constants";
import { createLogger } from "@sourcebot/logger";

const logger = createLogger('entitlements');

const eeLicenseKeyPrefix = "sourcebot_ee_";
export const SOURCEBOT_UNLIMITED_SEATS = -1;

const eeLicenseKeyPayloadSchema = z.object({
    id: z.string(),
    seats: z.number(),
    // ISO 8601 date string
    expiryDate: z.string().datetime(),
});

type LicenseKeyPayload = z.infer<typeof eeLicenseKeyPayloadSchema>;

const decodeLicenseKeyPayload = (payload: string): LicenseKeyPayload => {
    try {
        const decodedPayload = base64Decode(payload);
        const payloadJson = JSON.parse(decodedPayload);
        return eeLicenseKeyPayloadSchema.parse(payloadJson);
    } catch (error) {
        logger.error(`Failed to decode license key payload: ${error}`);
        process.exit(1);
    }
}

export const getLicenseKey = (): LicenseKeyPayload | null => {
    const licenseKey = env.SOURCEBOT_EE_LICENSE_KEY;
    if (licenseKey && licenseKey.startsWith(eeLicenseKeyPrefix)) {
        const payload = licenseKey.substring(eeLicenseKeyPrefix.length);
        return decodeLicenseKeyPayload(payload);
    }
    return null;
}

export const getPlan = (): Plan => {
    if (env.NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT) {
        if (env.NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT === "demo") {
            return "cloud:demo";
        }

        return "cloud:team";
    }

    const licenseKey = getLicenseKey();
    if (licenseKey) {
        const expiryDate = new Date(licenseKey.expiryDate);
        if (expiryDate.getTime() < new Date().getTime()) {
            logger.error(`The provided license key has expired (${expiryDate.toLocaleString()}). Falling back to oss plan. Please contact ${SOURCEBOT_SUPPORT_EMAIL} for support.`);
            process.exit(1);
        }

        return licenseKey.seats === SOURCEBOT_UNLIMITED_SEATS ? "self-hosted:enterprise-unlimited" : "self-hosted:enterprise";
    } else {
        logger.info(`No valid license key found. Falling back to oss plan.`);
        return "oss"; 
    }
}

export const getSeats = (): number => {
    const licenseKey = getLicenseKey();
    return licenseKey?.seats ?? SOURCEBOT_UNLIMITED_SEATS;
}

export const hasEntitlement = (entitlement: Entitlement) => {
    const entitlements = getEntitlements();
    return entitlements.includes(entitlement);
}

export const getEntitlements = (): Entitlement[] => {
    const plan = getPlan();
    return entitlementsByPlan[plan];
}
