import { env } from "@/env.mjs"
import { Entitlement, entitlementsByPlan, Plan } from "./constants"
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
});

type LicenseKeyPayload = z.infer<typeof eeLicenseKeyPayloadSchema>;

const decodeLicenseKeyPayload = (payload: string): LicenseKeyPayload => {
    const decodedPayload = base64Decode(payload);
    const payloadJson = JSON.parse(decodedPayload);
    return eeLicenseKeyPayloadSchema.parse(payloadJson);
}

export const getPlan = (): Plan => {
    if (env.NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT) {
        return "cloud:team";
    }

    const licenseKey = env.SOURCEBOT_EE_LICENSE_KEY;
    if (licenseKey && licenseKey.startsWith(eeLicenseKeyPrefix)) {
        const payload = licenseKey.substring(eeLicenseKeyPrefix.length);

        try {
            const { seats, expiryDate } = decodeLicenseKeyPayload(payload);

            if (new Date(expiryDate).getTime() < new Date().getTime()) {
                console.error(`The provided license key has expired. Falling back to oss plan. Please contact ${SOURCEBOT_SUPPORT_EMAIL} for support.`);
                return "oss";
            }

            return seats === SOURCEBOT_UNLIMITED_SEATS ? "self-hosted:enterprise-unlimited" : "self-hosted:enterprise";
        } catch (error) {
            console.error(`Failed to decode license key payload with error: ${error}`);
            console.info('Falling back to oss plan.');
            return "oss";
        }
    }

    return "oss";
}

export const getSeats = (): number => {
    const licenseKey = env.SOURCEBOT_EE_LICENSE_KEY;
    if (licenseKey && licenseKey.startsWith(eeLicenseKeyPrefix)) {
        const payload = licenseKey.substring(eeLicenseKeyPrefix.length);
        const { seats } = decodeLicenseKeyPayload(payload);
        return seats;
    }

    return SOURCEBOT_UNLIMITED_SEATS;
}

export const getLicenseKey = (): LicenseKeyPayload | null => {
    const licenseKey = env.SOURCEBOT_EE_LICENSE_KEY;
    if (licenseKey && licenseKey.startsWith(eeLicenseKeyPrefix)) {
        const payload = licenseKey.substring(eeLicenseKeyPrefix.length);
        const decodedPayload = decodeLicenseKeyPayload(payload);
        return decodedPayload;
    }
    return null;
}

export const hasEntitlement = (entitlement: Entitlement) => {
    const plan = getPlan();
    const entitlements = entitlementsByPlan[plan];
    return entitlements.includes(entitlement);
}
