import { base64Decode } from "./utils.js";
import { z } from "zod";
import { createLogger } from "./logger.js";
import { env } from "./env.server.js";
import { verifySignature } from "./crypto.js";
import { License } from "@sourcebot/db";
import { LicenseStatus } from "./types.js";

const logger = createLogger('entitlements');

const offlineLicensePrefix = "sourcebot_ee_";
const offlineLicensePayloadSchema = z.object({
    id: z.string(),
    seats: z.number().optional(),
    // ISO 8601 date string
    expiryDate: z.string().datetime(),
    // ISO 8601 instant. Optional for back-compat
    startDate: z.string().datetime().optional(),
    sig: z.string(),
});

type OfflineLicensePayload = z.infer<typeof offlineLicensePayloadSchema>;

const ACTIVE_ONLINE_LICENSE_STATUSES: LicenseStatus[] = [
    'active',
    'trialing',
    'past_due',
];

// @WARNING: when adding a new entitlement to this list, make sure
// lighthouse/lambda/entitlements.ts is also updated && deployed
// prior to rolling a new Sourcebot version.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ALL_ENTITLEMENTS = [
    "search-contexts",
    "sso",
    "code-nav",
    "audit",
    "analytics",
    "permission-syncing",
    "github-app",
    "org-management",
    "oauth",
    "ask",
    "mcp"
] as const;
export type Entitlement = (typeof ALL_ENTITLEMENTS)[number];

const decodeOfflineLicenseKeyPayload = (payload: string): OfflineLicensePayload | null => {
    try {
        const decodedPayload = base64Decode(payload);
        const payloadJson = JSON.parse(decodedPayload);
        const licenseData = offlineLicensePayloadSchema.parse(payloadJson);

        // NOTE: key order here is the signed-blob serialization order and must
        // match the signer exactly. `startDate` is appended last so
        // that for older licenses (where it is undefined) JSON.stringify omits
        // it, leaving the blob byte-identical and existing signatures valid.
        const dataToVerify = JSON.stringify({
            expiryDate: licenseData.expiryDate,
            id: licenseData.id,
            seats: licenseData.seats,
            startDate: licenseData.startDate
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

const getDecodedOfflineLicense = (): OfflineLicensePayload | null => {
    const licenseKey = env.SOURCEBOT_EE_LICENSE_KEY;
    if (!licenseKey || !licenseKey.startsWith(offlineLicensePrefix)) {
        return null;
    }

    return decodeOfflineLicenseKeyPayload(licenseKey.substring(offlineLicensePrefix.length));
}

const getValidOfflineLicense = (): OfflineLicensePayload | null => {
    const payload = getDecodedOfflineLicense();
    if (!payload) {
        return null;
    }

    const expiryDate = new Date(payload.expiryDate);
    if (expiryDate.getTime() < new Date().getTime()) {
        return null;
    }

    return payload;
}

// If the license hasn't successfully synced with Lighthouse for this long,
// the locally-cached state is no longer trusted. This guards against an
// operator blocking egress to prevent the license row from hearing about
// a canceled or past-due subscription. 7 days absorbs week-long transient
// outages (weekends, firewall rollouts) without punishing legitimate
// customers.
export const STALE_ONLINE_LICENSE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

// Surface a UI warning (banner + "refreshed" timestamp color) when the
// license hasn't synced for this long. Must be < the enforcement threshold
// so the warning has a chance to fire before entitlements are stripped.
export const STALE_ONLINE_LICENSE_WARNING_THRESHOLD_MS = 48 * 60 * 60 * 1000;

const getValidOnlineLicense = (_license: License | null): License | null => {
    if (
        _license &&
        _license.status &&
        ACTIVE_ONLINE_LICENSE_STATUSES.includes(_license.status as LicenseStatus) &&
        _license.lastSyncAt &&
        (Date.now() - _license.lastSyncAt.getTime()) <= STALE_ONLINE_LICENSE_THRESHOLD_MS &&
        _license.lastSyncErrorCode !== 'ACTIVATION_CODE_BOUND_TO_DIFFERENT_INSTANCE'
    ) {
        return _license;
    }

    return null;
}

export const isValidLicenseActive = (_license: License | null): boolean => {
    return (
        getValidOfflineLicense() !== null ||
        getValidOnlineLicense(_license) !== null
    );
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

export type OfflineLicenseMetadata = {
    id: string;
    seats?: number;
    expiryDate: string;
    startDate?: string;
}

// Returns the metadata of the offline license if one is configured, even
// if it has expired. Callers that only care about active entitlements
// should use `getEntitlements` / `getValidOfflineLicense` instead.
export const getOfflineLicenseMetadata = (): OfflineLicenseMetadata | null => {
    const license = getDecodedOfflineLicense();
    if (!license) {
        return null;
    }

    return {
        id: license.id,
        seats: license.seats,
        expiryDate: license.expiryDate,
        startDate: license.startDate,
    };
}

export const getSeatCap = (): number | undefined => {
    const offlineLicense = getValidOfflineLicense();
    if (offlineLicense?.seats && offlineLicense.seats > 0) {
        return offlineLicense.seats;
    }

    return undefined;
}