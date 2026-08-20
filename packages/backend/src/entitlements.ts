import {
    Entitlement,
    _hasEntitlement,
    _getEntitlements,
    env,
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

export const isPermissionSyncEnabled = async (): Promise<boolean> =>
    env.PERMISSION_SYNC_ENABLED === "true" &&
    (await hasEntitlement("permission-syncing"));

export const getEntitlements = async (): Promise<Entitlement[]> => {
    const license = await getLicense();
    return _getEntitlements(license);
}
