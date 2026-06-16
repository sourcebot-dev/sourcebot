import { __unsafePrisma } from "@/prisma";
import { hasEntitlement } from "@/lib/entitlements";

export const isScimEnabled = async (orgId: number): Promise<boolean> => {
    if (!await hasEntitlement('scim')) {
        return false;
    }
    const tokenCount = await __unsafePrisma.scimToken.count({ where: { orgId } });
    return tokenCount > 0;
};
