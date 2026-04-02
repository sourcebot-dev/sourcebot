import { getMe } from "@/actions";
import { ServiceErrorException } from "@/lib/serviceError";
import { notFound } from "next/navigation";
import { isServiceError } from "@/lib/utils";
import { OrgRole } from "@sourcebot/db";
import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";
import { prisma } from "@/prisma";
import { env } from "@sourcebot/shared";

export default async function ApiKeysLayout({ children }: { children: React.ReactNode }) {
    const org = await prisma.org.findUnique({ where: { id: SINGLE_TENANT_ORG_ID } });
    if (!org) {
        throw new Error("Organization not found");
    }

    const me = await getMe();
    if (isServiceError(me)) {
        throw new ServiceErrorException(me);
    }

    const userRoleInOrg = me.memberships.find((membership) => membership.id === org.id)?.role;
    if (!userRoleInOrg) {
        throw new Error("User role not found");
    }

    if (env.DISABLE_API_KEY_USAGE_FOR_NON_OWNER_USERS === 'true' && userRoleInOrg !== OrgRole.OWNER) {
        return notFound();
    }

    return children;
}