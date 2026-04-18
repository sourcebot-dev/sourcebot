import { base64Decode } from "./utils.js";
import { z } from "zod";
import { createLogger } from "./logger.js";
import { env } from "./env.server.js";
import { verifySignature } from "./crypto.js";
import { License } from "@sourcebot/db";

const logger = createLogger('entitlements');

const offlineLicensePrefix = "sourcebot_ee_";
const offlineLicensePayloadSchema = z.object({
    id: z.string(),
    seats: z.number().optional(),
    // ISO 8601 date string
    expiryDate: z.string().datetime(),
    sig: z.string(),
});

type getValidOfflineLicense = z.infer<typeof offlineLicensePayloadSchema>;

const ACTIVE_ONLINE_LICENSE_STATUSES = ['active', 'trialing', 'past_due'] as const;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ALL_ENTITLEMENTS = [
    "search-contexts",
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
export type Entitlement = (typeof ALL_ENTITLEMENTS)[number];

const decodeOfflineLicenseKeyPayload = (payload: string): getValidOfflineLicense | null => {
    try {
        const decodedPayload = base64Decode(payload);
        const payloadJson = JSON.parse(decodedPayload);
        const licenseData = offlineLicensePayloadSchema.parse(payloadJson);

        const dataToVerify = JSON.stringify({
            expiryDate: licenseData.expiryDate,
            id: licenseData.id,
            seats: licenseData.seats
        });

        const isSignatureValid = verifySignature(dataToVerify, licenseData.sig, env.SOURCEBOT_PUBLIC_KEY_PATH);
        if (!isSignatureValid) {
            logger.error('License key signature verification failed');
            return null;
        }

        return licenseData;
    } catch (error) {
        logger.error(`Failed to decode license key payload: ${error}`);
        return null;
    }
}

const getValidOfflineLicense = (): getValidOfflineLicense | null => {
    const licenseKey = env.SOURCEBOT_EE_LICENSE_KEY;
    if (!licenseKey || !licenseKey.startsWith(offlineLicensePrefix)) {
        return null;
    }

    const payload = decodeOfflineLicenseKeyPayload(licenseKey.substring(offlineLicensePrefix.length));
    if (!payload) {
        return null;
    }

    const expiryDate = new Date(payload.expiryDate);
    if (expiryDate.getTime() < new Date().getTime()) {
        return null;
    }

    return payload;
}

const getValidOnlineLicense = (_license: License | null): License | null => {
    if (
        _license &&
        _license.status &&
        ACTIVE_ONLINE_LICENSE_STATUSES.includes(_license.status as typeof ACTIVE_ONLINE_LICENSE_STATUSES[number])
    ) {
        return _license;
    }

    return null;
}

export const isAnonymousAccessAvailable = (_license: License | null): boolean => {
    const offlineKey = getValidOfflineLicense();
    if (offlineKey) {
        return offlineKey.seats === undefined;
    }

    const onlineLicense = getValidOnlineLicense(_license);
    if (onlineLicense) {
        return false;
    }
    return true;
}

export const getEntitlements = (_license: License | null): Entitlement[] => {
    const offlineLicense = getValidOfflineLicense();
    if (offlineLicense) {
        return ALL_ENTITLEMENTS as unknown as Entitlement[];
    }

    const onlineLicense = getValidOnlineLicense(_license);
    if (onlineLicense) {
        return onlineLicense.entitlements as unknown as Entitlement[];
    }
    else {
        return [];
    }
}

export const hasEntitlement = (entitlement: Entitlement, _license: License | null) => {
    const entitlements = getEntitlements(_license);
    return entitlements.includes(entitlement);
}

export const getSeatCap = (): number | undefined => {
    const offlineLicense = getValidOfflineLicense();
    if (offlineLicense?.seats && offlineLicense.seats > 0) {
        return offlineLicense.seats;
    }

    return undefined;
}