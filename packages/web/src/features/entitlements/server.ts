import { env } from "@/env.mjs"
import { Entitlement, entitlementsByPlan, Plan, isValidEntitlement } from "./constants"
import { base64Decode } from "@/lib/utils";
import { z } from "zod";
import { SOURCEBOT_SUPPORT_EMAIL } from "@/lib/constants";

const eeLicenseKeyPrefix = "sourcebot_ee_";
export const SOURCEBOT_UNLIMITED_SEATS = -1;

const eeLicenseKeyPayloadSchema = z.object({
    id: z.string(),
    seats: z.number(),
    // ISO 8601 date string
    expiryDate: z.string().datetime(),
    customEntitlements: z.array(z.string()).optional()
});

type LicenseKeyPayload = z.infer<typeof eeLicenseKeyPayloadSchema>;

const decodeLicenseKeyPayload = (payload: string): LicenseKeyPayload => {
    try {
        const decodedPayload = base64Decode(payload);
        const payloadJson = JSON.parse(decodedPayload);
        return eeLicenseKeyPayloadSchema.parse(payloadJson);
    } catch (error) {
        console.error(`Failed to decode license key payload: ${error}`);
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
        return "cloud:team";
    }

    const licenseKey = getLicenseKey();
    if (licenseKey) {
        const expiryDate = new Date(licenseKey.expiryDate);
        if (expiryDate.getTime() < new Date().getTime()) {
            console.error(`The provided license key has expired (${expiryDate.toLocaleString()}). Falling back to oss plan. Please contact ${SOURCEBOT_SUPPORT_EMAIL} for support.`);
            return "oss";
        }

        if (licenseKey.customEntitlements) {
            return "self-hosted:enterprise-custom";
        }
        return licenseKey.seats === SOURCEBOT_UNLIMITED_SEATS ? "self-hosted:enterprise-unlimited" : "self-hosted:enterprise";
    } else {
        console.info(`No valid license key found. Falling back to oss plan.`);
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
    const licenseKey = getLicenseKey();
    if (!licenseKey) {
        return entitlementsByPlan["oss"];
    }

    const plan = getPlan();
    if (plan === "self-hosted:enterprise-custom") {
        const customEntitlements = licenseKey.customEntitlements;
        if (!customEntitlements) {
            console.error(`The provided license key is under the self-hosted:enterprise plan but has no custom entitlements. Returning oss entitlements.`);
            return entitlementsByPlan["oss"];
        }

        const validCustomEntitlements: Entitlement[] = [];
        for (const entitlement of customEntitlements) {
            if (!isValidEntitlement(entitlement)) {
                console.error(`Invalid custom entitlement "${entitlement}" provided in license key. Skipping.`);
                continue;
            }
            validCustomEntitlements.push(entitlement as Entitlement);
        }

        return validCustomEntitlements;
    }

    return entitlementsByPlan[plan];
}
