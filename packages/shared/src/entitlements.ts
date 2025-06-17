import { base64Decode } from "./utils.js";
import { z } from "zod";
import { createLogger } from "@sourcebot/logger";
import { verifySignature } from "@sourcebot/crypto";
import { env } from "./env.js";
import { SOURCEBOT_SUPPORT_EMAIL, SOURCEBOT_UNLIMITED_SEATS } from "./constants.js";

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
const planLabels = {
    oss: "OSS",
    "cloud:team": "Team",
    "cloud:demo": "Demo",
    "self-hosted:enterprise": "Enterprise (Self-Hosted)",
    "self-hosted:enterprise-unlimited": "Enterprise (Self-Hosted) Unlimited",
} as const;
export type Plan = keyof typeof planLabels;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const entitlements = [
    "search-contexts",
    "billing",
    "public-access",
    "multi-tenancy",
    "sso",
    "code-nav"
] as const;
export type Entitlement = (typeof entitlements)[number];

const entitlementsByPlan: Record<Plan, Entitlement[]> = {
    oss: [],
    "cloud:team": ["billing", "multi-tenancy", "sso", "code-nav"],
    "self-hosted:enterprise": ["search-contexts", "sso", "code-nav"],
    "self-hosted:enterprise-unlimited": ["search-contexts", "public-access", "sso", "code-nav"],
    // Special entitlement for https://demo.sourcebot.dev
    "cloud:demo": ["public-access", "code-nav", "search-contexts"],
} as const;


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
            logger.error(`The provided license key has expired (${expiryDate.toLocaleString()}). Please contact ${SOURCEBOT_SUPPORT_EMAIL} for support.`);
            process.exit(1);
        }

        return licenseKey.seats === SOURCEBOT_UNLIMITED_SEATS ? "self-hosted:enterprise-unlimited" : "self-hosted:enterprise";
    } else {
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
