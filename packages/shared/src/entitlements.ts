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

const ONLINE_LICENSE_ASSERTION_AUDIENCE = 'sourcebot-online-license';
const ONLINE_LICENSE_ASSERTION_CLOCK_SKEW_MS = 5 * 60 * 1000;

// Compatibility switch for the first release that understands signed online
// licenses. Set this to false in the enforcement release, after Lighthouse has
// been returning assertions for at least one full online-license TTL.
const ALLOW_LEGACY_UNSIGNED_ONLINE_LICENSES = true;

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

const onlineLicenseAssertionPayloadSchema = z.object({
    version: z.literal(1),
    audience: z.literal(ONLINE_LICENSE_ASSERTION_AUDIENCE),
    licenseId: z.string().min(1),
    installId: z.string().min(1),
    status: z.enum([
        'active',
        'trialing',
        'past_due',
        'unpaid',
        'canceled',
        'incomplete',
        'incomplete_expired',
        'paused',
    ]),
    entitlements: z.array(z.enum(ALL_ENTITLEMENTS)),
    seats: z.number().int().nonnegative(),
    issuedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
}).strict();

export type OnlineLicenseAssertionPayload = z.infer<typeof onlineLicenseAssertionPayloadSchema>;

/**
 * Verifies and decodes an online-license assertion. The signature covers the
 * encoded payload itself, avoiding cross-language JSON canonicalization.
 */
export const verifyOnlineLicenseAssertion = (assertion: string): OnlineLicenseAssertionPayload | null => {
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
        const payload = onlineLicenseAssertionPayloadSchema.parse(JSON.parse(decodedPayload));
        const issuedAt = new Date(payload.issuedAt).getTime();
        const expiresAt = new Date(payload.expiresAt).getTime();
        const now = Date.now();

        if (
            payload.installId !== env.SOURCEBOT_INSTALL_ID ||
            issuedAt > now + ONLINE_LICENSE_ASSERTION_CLOCK_SKEW_MS ||
            expiresAt <= now ||
            expiresAt <= issuedAt ||
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

type ValidOnlineLicense = Pick<OnlineLicenseAssertionPayload, 'entitlements' | 'status'>;

const getValidLegacyOnlineLicense = (_license: License | null): ValidOnlineLicense | null => {
    if (
        _license &&
        _license.status &&
        ACTIVE_ONLINE_LICENSE_STATUSES.includes(_license.status as LicenseStatus) &&
        _license.lastSyncAt &&
        (Date.now() - _license.lastSyncAt.getTime()) <= STALE_ONLINE_LICENSE_THRESHOLD_MS &&
        _license.lastSyncErrorCode !== 'ACTIVATION_CODE_BOUND_TO_DIFFERENT_INSTANCE'
    ) {
        return {
            entitlements: _license.entitlements as Entitlement[],
            status: _license.status as LicenseStatus,
        };
    }

    return null;
}

const getValidOnlineLicense = (_license: License | null): ValidOnlineLicense | null => {
    // A present but invalid assertion must never fall back to unsigned columns.
    if (_license?.licenseAssertion !== null && _license?.licenseAssertion !== undefined) {
        if (_license.lastSyncErrorCode === 'ACTIVATION_CODE_BOUND_TO_DIFFERENT_INSTANCE') {
            return null;
        }

        const assertion = verifyOnlineLicenseAssertion(_license.licenseAssertion);
        if (assertion && ACTIVE_ONLINE_LICENSE_STATUSES.includes(assertion.status)) {
            return assertion;
        }

        return null;
    }

    if (ALLOW_LEGACY_UNSIGNED_ONLINE_LICENSES) {
        return getValidLegacyOnlineLicense(_license);
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
