import { auth } from "@/auth";
import { getUserOrgs } from "../../../../data/user";
import { OrgSelectorDropdown } from "./orgSelectorDropdown";
import { prisma } from "@/prisma";

interface OrgSelectorProps {
    domain: string;
}

export const OrgSelector = async ({
    domain,
}: OrgSelectorProps) => {
    const session = await auth();
    if (!session) {
        return null;
    }

    const orgs = await getUserOrgs(session.user.id);
    const activeOrg = await prisma.org.findUnique({
        where: {
            domain,
        }
    });

    if (!activeOrg) {
        return null;
    }

    return (
        <OrgSelectorDropdown
            orgs={orgs.map((org) => ({
                name: org.name,
                id: org.id,
                domain: org.domain,
            }))}
            activeOrgId={activeOrg.id}
        />
    )
}