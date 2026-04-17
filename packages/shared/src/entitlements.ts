import { base64Decode } from "./utils.js";
import { z } from "zod";
import { createLogger } from "./logger.js";
import { env } from "./env.server.js";
import { SOURCEBOT_SUPPORT_EMAIL } from "./constants.js";
import { verifySignature } from "./crypto.js";
import { License } from "@sourcebot/db";

const logger = createLogger('entitlements');

const eeLicenseKeyPrefix = "sourcebot_ee_";

const eeLicenseKeyPayloadSchema = z.object({
    id: z.string(),
    seats: z.number(),
    // ISO 8601 date string
    expiryDate: z.string().datetime(),
    sig: z.string(),
});

type LicenseKeyPayload = z.infer<typeof eeLicenseKeyPayloadSchema>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const entitlements = [
    "search-contexts",
    "anonymous-access",
    "sso",
    "code-nav",
    "audit",
    "analytics",
    "permission-syncing",
    "github-app",
    "chat-sharing",
    "org-management",
    "oauth",
] as const;
export type Entitlement = (typeof entitlements)[number];

const ACTIVE_LICENSE_STATUSES = ['active', 'trialing', 'past_due'] as const;

const isLicenseActive = (license: License): boolean => {
    if (!license.status) {
        return false;
    }
    return ACTIVE_LICENSE_STATUSES.includes(license.status as typeof ACTIVE_LICENSE_STATUSES[number]);
}

const decodeLicenseKeyPayload = (payload: string): LicenseKeyPayload => {
    try {
        const decodedPayload = base64Decode(payload);
        const payloadJson = JSON.parse(decodedPayload);
        const licenseData = eeLicenseKeyPayloadSchema.parse(payloadJson);

        const dataToVerify = JSON.stringify({
            expiryDate: licenseData.expiryDate,
            id: licenseData.id,
            seats: licenseData.seats
        });

        const isSignatureValid = verifySignature(dataToVerify, licenseData.sig, env.SOURCEBOT_PUBLIC_KEY_PATH);
        if (!isSignatureValid) {
            logger.error('License key signature verification failed');
            process.exit(1);
        }

        return licenseData;
    } catch (error) {
        logger.error(`Failed to decode license key payload: ${error}`);
        process.exit(1);
    }
}

export const getOfflineLicenseKey = (): LicenseKeyPayload | null => {
    const licenseKey = env.SOURCEBOT_EE_LICENSE_KEY;
    if (licenseKey && licenseKey.startsWith(eeLicenseKeyPrefix)) {
        const payload = licenseKey.substring(eeLicenseKeyPrefix.length);
        return decodeLicenseKeyPayload(payload);
    }
    return null;
}

export const hasEntitlement = (entitlement: Entitlement, license: License | null) => {
    const entitlements = getEntitlements(license);
    return entitlements.includes(entitlement);
}

export const getEntitlements = (license: License | null): Entitlement[] => {
    const licenseKey = getOfflineLicenseKey();
    if (licenseKey) {
        const expiryDate = new Date(licenseKey.expiryDate);
        if (expiryDate.getTime() < new Date().getTime()) {
            logger.error(`The provided license key has expired (${expiryDate.toLocaleString()}). Please contact ${SOURCEBOT_SUPPORT_EMAIL} for support.`);
            process.exit(1);
        }

        return entitlements as unknown as Entitlement[];
    }
    else if (license && isLicenseActive(license)) {
        return license.entitlements as unknown as Entitlement[];
    }
    else {
        return [];
    }
}
