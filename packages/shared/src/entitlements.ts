import { base64Decode } from "./utils.js";
import { z } from "zod";
import { createLogger } from "./logger.js";
import { env } from "./env.server.js";
import { verifySignature } from "./crypto.js";
import { License } from "@sourcebot/db";
import { LicenseStatus } from "./types.js";
import {
    onlineLicenseAssertionClaimsSchema,
    type OnlineLicenseAssertionClaims,
} from './lighthouseTypes.js';

const logger = createLogger('entitlements');

const offlineLicensePrefix = "sourcebot_ee_";
const offlineLicensePayloadSchema = z.object({
    id: z.string(),
    seats: z.number().optional(),
    // Whether anonymous (unauthenticated) access is permitted.
    anonymousAccess: z.boolean().optional(),
    // ISO 8601 date string
    expiryDate: z.string().datetime(),
    sig: z.string(),
});

type getValidOfflineLicense = z.infer<typeof offlineLicensePayloadSchema>;

const ACTIVE_ONLINE_LICENSE_STATUSES: LicenseStatus[] = [
    'active',
    'trialing',
    'past_due',
];

const isActiveOnlineLicenseStatus = (status: string): status is LicenseStatus =>
    ACTIVE_ONLINE_LICENSE_STATUSES.includes(status as LicenseStatus);

const ONLINE_LICENSE_ASSERTION_CLOCK_SKEW_MS = 5 * 60 * 1000;

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
    "mcp",
    "scim"
] as const;
export type Entitlement = (typeof ALL_ENTITLEMENTS)[number];

const isKnownEntitlement = (entitlement: string): entitlement is Entitlement =>
    (ALL_ENTITLEMENTS as readonly string[]).includes(entitlement);

/**
 * Verifies and decodes an online-license assertion. The signature covers the
 * encoded payload itself, avoiding cross-language JSON canonicalization.
 */
export const verifyOnlineLicenseAssertion = (assertion: string): OnlineLicenseAssertionClaims | null => {
    try {
        const parts = assertion.split('.');
        if (parts.length !== 2) {
            return null;
        }

        const [encodedPayload, signature] = parts;
        if (!encodedPayload || !signature) {
            return null;
        }

        if (!verifySignature(encodedPayload, signature, env.SOURCEBOT_PUBLIC_KEY_PATH)) {
            logger.error('Online license assertion signature verification failed');
            return null;
        }

        const decodedPayload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
        const payload = onlineLicenseAssertionClaimsSchema.parse(JSON.parse(decodedPayload));
        const issuedAt = new Date(payload.issuedAt).getTime();
        const expiresAt = new Date(payload.expiresAt).getTime();
        const now = Date.now();

        // A license is considered invalid under the following
        // circumstances:
        if (
            // 1. It was issued for a different Sourcebot installation.
            payload.installId !== env.SOURCEBOT_INSTALL_ID ||
            // 2. It claims to have been issued too far in the future. A small
            // clock-skew allowance accounts for clocks being slightly out of sync.
            issuedAt > now + ONLINE_LICENSE_ASSERTION_CLOCK_SKEW_MS ||
            // 3. Its expiration time has already passed.
            expiresAt <= now ||
            // 4. It expires at or before the time it claims to have been issued.
            expiresAt <= issuedAt ||
            // 5. Its total validity period exceeds the maximum allowed lifetime.
            (expiresAt - issuedAt) > STALE_ONLINE_LICENSE_THRESHOLD_MS
        ) {
            logger.error('Online license assertion claims are invalid');
            return null;
        }

        return payload;
    } catch (error) {
        logger.error(`Failed to verify online license assertion: ${error}`);
        return null;
    }
};

const decodeOfflineLicenseKeyPayload = (payload: string): getValidOfflineLicense | null => {
    try {
        const decodedPayload = base64Decode(payload);
        const payloadJson = JSON.parse(decodedPayload);
        const licenseData = offlineLicensePayloadSchema.parse(payloadJson);

        // Keys are listed alphabetically to match the canonical JSON the
        // signer produces (Python `json.dumps(..., sort_keys=True)`).
        // `JSON.stringify` drops `undefined` values, so omitted optional
        // fields (e.g. a legacy key without `anonymousAccess`) verify exactly
        // as they were originally signed.
        const dataToVerify = JSON.stringify({
            anonymousAccess: licenseData.anonymousAccess,
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

const getDecodedOfflineLicense = (): getValidOfflineLicense | null => {
    const licenseKey = env.SOURCEBOT_EE_LICENSE_KEY;
    if (!licenseKey || !licenseKey.startsWith(offlineLicensePrefix)) {
        return null;
    }

    return decodeOfflineLicenseKeyPayload(licenseKey.substring(offlineLicensePrefix.length));
}

const getValidOfflineLicense = (): getValidOfflineLicense | null => {
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

type ValidOnlineLicense = {
    entitlements: Entitlement[];
    status: LicenseStatus;
};

const getValidOnlineLicense = (_license: License | null): ValidOnlineLicense | null => {
    // Unsigned database columns never grant online entitlements.
    if (!_license?.licenseAssertion) {
        return null;
    }

    if (_license.lastSyncErrorCode === 'ACTIVATION_CODE_BOUND_TO_DIFFERENT_INSTANCE') {
        return null;
    }

    const assertion = verifyOnlineLicenseAssertion(_license.licenseAssertion);
    if (assertion && isActiveOnlineLicenseStatus(assertion.license.status)) {
        return {
            entitlements: assertion.license.entitlements.filter(isKnownEntitlement),
            status: assertion.license.status,
        };
    }

    return null;
}

export const isValidOfflineLicenseActive = (): boolean => {
    return getValidOfflineLicense() !== null;
}

export const isValidOnlineLicenseActive = (_license: License | null): boolean => {
    return getValidOnlineLicense(_license) !== null;
}

export const isValidLicenseActive = (_license: License | null): boolean => {
    return (
        isValidOfflineLicenseActive() ||
        isValidOnlineLicenseActive(_license)
    );
}

export const isAnonymousAccessAvailable = (_license: License | null): boolean => {
    const offlineKey = getValidOfflineLicense();
    if (offlineKey) {
        return offlineKey.anonymousAccess === true;
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
    anonymousAccess?: boolean;
    expiryDate: string;
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
        anonymousAccess: license.anonymousAccess,
        expiryDate: license.expiryDate,
    };
}

export const getSeatCap = (): number | undefined => {
    const offlineLicense = getValidOfflineLicense();
    if (offlineLicense?.seats && offlineLicense.seats > 0) {
        return offlineLicense.seats;
    }

    return undefined;
}
