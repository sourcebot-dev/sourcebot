import { MembersList } from "./components/membersList";
import { getOrgMembers } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { auth } from "@/auth";
import { getUser, getUserRoleInOrg } from "@/data/user";
import { getOrgFromDomain } from "@/data/org";
import { InviteMemberCard } from "./components/inviteMemberCard";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { TabSwitcher } from "@/components/ui/tab-switcher";
import { InvitesList } from "./components/invitesList";
import { getOrgInvites } from "@/actions";

interface MembersSettingsPageProps {
    params: {
        domain: string
    },
    searchParams: {
        tab?: string
    }
}

export default async function MembersSettingsPage({ params: { domain }, searchParams: { tab } }: MembersSettingsPageProps) {
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

    const invites = await getOrgInvites(domain);
    if (isServiceError(invites)) {
        return null;
    }

    const currentTab = tab || "members";

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-lg font-medium">Members</h3>
                <p className="text-sm text-muted-foreground">Invite and manage members of your organization.</p>
            </div>

            <InviteMemberCard
                currentUserRole={userRoleInOrg}
            />

            <Tabs value={currentTab}>
                <div className="border-b border-border w-full">
                    <TabSwitcher
                        className="h-auto p-0 bg-transparent"
                        tabs={[
                            { label: "Team Members", value: "members" },
                            { label: "Pending Invites", value: "invites" },
                        ]}
                        currentTab={currentTab}
                    />
                </div>
                <TabsContent value="members">
                        <MembersList
                            members={members}
                            currentUserId={session.user.id}
                            currentUserRole={userRoleInOrg}
                            orgName={org.name}
                    />
                </TabsContent>

                <TabsContent value="invites">
                    <InvitesList
                        invites={invites}
                        currentUserRole={userRoleInOrg}
                    />
                </TabsContent>
            </Tabs>
        </div>
    )
}
