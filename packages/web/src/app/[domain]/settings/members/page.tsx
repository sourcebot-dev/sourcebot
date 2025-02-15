import { Separator } from "@/components/ui/separator";
import { MembersList } from "./components/membersList";
import { getOrgMembers } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { auth } from "@/auth";
import { getUser, getUserRoleInOrg } from "@/data/user";
import { getOrgFromDomain } from "@/data/org";

interface MembersSettingsPageProps {
    params: {
        domain: string
    }
}

export default async function MembersSettingsPage({ params: { domain } }: MembersSettingsPageProps) {
    const session = await auth();
    if (!session) {
        return null;
    }

    const members = await getOrgMembers(domain);
    const org = await getOrgFromDomain(domain);
    if (!org) {
        return null;
    }

    const user = await getUser(session.user.id);
    if (!user) {
        return null;
    }

    const userRoleInOrg = await getUserRoleInOrg(user.id, org.id);
    if (!userRoleInOrg) {
        return null;
    }

    if (isServiceError(members)) {
        return null;
    }

    return (
        <div>
            <div>
                <h3 className="text-lg font-medium">Members</h3>
                <p className="text-sm text-muted-foreground">Invite and manage members of your organization.</p>
            </div>
            <Separator className="my-6" />

            <MembersList
                members={members.map((member) => ({
                    id: member.id,
                    email: member.email,
                    name: member.name,
                    role: member.role,
                    joinedAt: member.joinedAt,
                    avatarUrl: member.avatarUrl,
                }))}
                currentUserId={session.user.id}
                currentUserRole={userRoleInOrg}
                orgName={org.name}
            />
        </div>
    )
}
