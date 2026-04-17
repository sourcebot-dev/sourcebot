import {
    getEntitlements as _getEntitlements,
    hasEntitlement as _hasEntitlement,
    Entitlement,
} from "@sourcebot/shared";
import { __unsafePrisma } from "@/prisma";
import { SINGLE_TENANT_ORG_ID } from "./constants";

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