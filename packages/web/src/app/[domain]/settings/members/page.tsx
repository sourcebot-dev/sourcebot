import { MembersList } from "./components/membersList";
import { getOrgMembers } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { getOrgFromDomain } from "@/data/org";
import { InviteMemberCard } from "./components/inviteMemberCard";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { TabSwitcher } from "@/components/ui/tab-switcher";
import { InvitesList } from "./components/invitesList";
import { getOrgInvites, getMe } from "@/actions";
import { IS_BILLING_ENABLED } from "@/lib/stripe";
import { ServiceErrorException } from "@/lib/serviceError";
interface MembersSettingsPageProps {
    params: {
        domain: string
    },
    searchParams: {
        tab?: string
    }
}

export default async function MembersSettingsPage({ params: { domain }, searchParams: { tab } }: MembersSettingsPageProps) {
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

    const members = await getOrgMembers(domain);
    if (isServiceError(members)) {
        throw new ServiceErrorException(members);
    }

    const invites = await getOrgInvites(domain);
    if (isServiceError(invites)) {
        throw new ServiceErrorException(invites);
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
                isBillingEnabled={IS_BILLING_ENABLED}
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
                            currentUserId={me.id}
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
