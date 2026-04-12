import {
    Entitlement,
    Plan,
    getPlan as _getPlan,
    getSeats as _getSeats,
    hasEntitlement as _hasEntitlement,
    getEntitlements as _getEntitlements,
} from "@sourcebot/shared";
import { prisma } from "./prisma.js";
import { SINGLE_TENANT_ORG_ID } from "./constants.js";

const getLicense = async () => {
    return prisma.license.findUnique({
        where: { orgId: SINGLE_TENANT_ORG_ID },
    });
}

export const getPlan = async (): Promise<Plan> => {
    const license = await getLicense();
    return _getPlan(license);
}

export const getSeats = async (): Promise<number> => {
    const license = await getLicense();
    return _getSeats(license);
}

export const hasEntitlement = async (entitlement: Entitlement): Promise<boolean> => {
    const license = await getLicense();
    return _hasEntitlement(entitlement, license);
}

export const getEntitlements = async (): Promise<Entitlement[]> => {
    const license = await getLicense();
    return _getEntitlements(license);
}
