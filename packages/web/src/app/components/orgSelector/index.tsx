import { auth } from "@/auth";
import { getUser, getUserOrgs } from "../../data/user";
import { OrgSelectorDropdown } from "./orgSelectorDropdown";

export const OrgSelector = async () => {
    const session = await auth();
    if (!session) {
        return null;
    }

    const user = await getUser(session.user.id);
    if (!user) {
        return null;
    }

    const orgs = await getUserOrgs(session.user.id);
    const activeOrg = orgs.find((org) => org.id === user.activeOrgId);
    if (!activeOrg) {
        return null;
    }

    return (
        <OrgSelectorDropdown
            orgs={orgs.map((org) => ({
                name: org.name,
                id: org.id,
            }))}
            activeOrgId={activeOrg.id}
        />
    )
}