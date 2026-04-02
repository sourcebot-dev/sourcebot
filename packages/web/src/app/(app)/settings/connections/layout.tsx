import { getMe } from "@/actions";
import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";
import { prisma } from "@/prisma";
import { ServiceErrorException } from "@/lib/serviceError";
import { notFound } from "next/navigation";
import { isServiceError } from "@/lib/utils";
import { OrgRole } from "@sourcebot/db";


interface ConnectionsLayoutProps {
    children: React.ReactNode;
}

export default async function ConnectionsLayout({ children }: ConnectionsLayoutProps) {
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

    if (userRoleInOrg !== OrgRole.OWNER) {
        return notFound();
    }

    return children;
}