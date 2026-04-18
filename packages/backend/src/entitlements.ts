import {
    Entitlement,
    _hasEntitlement,
    _getEntitlements,
} from "@sourcebot/shared";
import { prisma } from "./prisma.js";
import { SINGLE_TENANT_ORG_ID } from "./constants.js";

const getLicense = async () => {
    return prisma.license.findUnique({
        where: { orgId: SINGLE_TENANT_ORG_ID },
    });
}

export const hasEntitlement = async (entitlement: Entitlement): Promise<boolean> => {
    const license = await getLicense();
    return _hasEntitlement(entitlement, license);
}

export const getEntitlements = async (): Promise<Entitlement[]> => {
    const license = await getLicense();
    return _getEntitlements(license);
}
