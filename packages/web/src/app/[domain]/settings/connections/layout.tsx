import { getMe } from "@/actions";
import { getOrgFromDomain } from "@/data/org";
import { ServiceErrorException } from "@/lib/serviceError";
import { notFound } from "next/navigation";
import { isServiceError } from "@/lib/utils";
import { OrgRole } from "@sourcebot/db";


interface ConnectionsLayoutProps {
    children: React.ReactNode;
    params: Promise<{
        domain: string
    }>;
}

export default async function ConnectionsLayout({ children, params }: ConnectionsLayoutProps) {
    const { domain } = await params;

    const org = await getOrgFromDomain(domain);
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