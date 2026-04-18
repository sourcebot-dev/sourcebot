import {
    getEntitlements as _getEntitlements,
    hasEntitlement as _hasEntitlement,
    isAnonymousAccessEnabled as _isAnonymousAccessAvailable,
    Entitlement,
    env,
} from "@sourcebot/shared";
import { __unsafePrisma } from "@/prisma";
import { SINGLE_TENANT_ORG_ID } from "./constants";
import { getOrgMetadata } from "./utils";

const getSingleTenantLicense = async () => {
    try {
        return await __unsafePrisma.license.findUnique({
            where: {
                orgId: SINGLE_TENANT_ORG_ID,
            },
        });
    } catch {
        return null;
    }
}

export const getEntitlements = async () => {
    const license = await getSingleTenantLicense();
    return _getEntitlements(license);
}

export const hasEntitlement = async (entitlement: Entitlement) => {
    const license = await getSingleTenantLicense();
    return _hasEntitlement(entitlement, license);
}

export const isAnonymousAccessAvailable = async () => {
    const license = await getSingleTenantLicense();
    return _isAnonymousAccessAvailable(license);
}

export const isAnonymousAccessEnabled = async () => {
    if (!await isAnonymousAccessAvailable()) {
        return false;
    }

    if (env.FORCE_ENABLE_ANONYMOUS_ACCESS === 'true') {
        return true;
    }

    const org = await __unsafePrisma.org.findUnique({
        where: { id: SINGLE_TENANT_ORG_ID },
    });

    if (!org) {
        return false;
    }

    const metadata = getOrgMetadata(org);

    return !!metadata?.anonymousAccessEnabled;
}