import { OrgSelectorDropdown } from "./orgSelectorDropdown";
import { prisma } from "@/prisma";
import { getMe } from "@/actions";
import { isServiceError } from "@/lib/utils";

interface OrgSelectorProps {
    domain: string;
}

export const OrgSelector = async ({
    domain,
}: OrgSelectorProps) => {
    const user = await getMe();
    if (isServiceError(user)) {
        return null;
    }

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
            orgs={user.memberships.map(({ name, domain, id }) => ({
                name,
                domain,
                id,
            }))}
            activeOrgId={activeOrg.id}
        />
    )
}