import { MembersList } from "./components/membersList";
import { getOrgMembers } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { getOrgFromDomain } from "@/data/org";
import { InviteMemberCard } from "./components/inviteMemberCard";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { TabSwitcher } from "@/components/ui/tab-switcher";
import { InvitesList } from "./components/invitesList";
import { getOrgInvites, getMe, getOrgAccountRequests } from "@/actions";
import { IS_BILLING_ENABLED } from "@/ee/features/billing/stripe";
import { ServiceErrorException } from "@/lib/serviceError";
import { getSeats, SOURCEBOT_UNLIMITED_SEATS } from "@sourcebot/shared";
import { RequestsList } from "./components/requestsList";
import { OrgRole } from "@prisma/client";
import { MemberApprovalRequiredToggle } from "@/app/onboard/components/memberApprovalRequiredToggle";

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

    const requests = await getOrgAccountRequests(domain);
    if (isServiceError(requests)) {
        throw new ServiceErrorException(requests);
    }

    const currentTab = tab || "members";

    const seats = getSeats();
    const usedSeats = members.length
    const seatsAvailable = seats === SOURCEBOT_UNLIMITED_SEATS || usedSeats < seats;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-lg font-medium">Members</h3>
                    <p className="text-sm text-muted-foreground">Invite and manage members of your organization.</p>
                </div>
                {seats && seats !== SOURCEBOT_UNLIMITED_SEATS && (
                    <div className="bg-card px-4 py-2 rounded-md border shadow-sm">
                        <div className="text-sm">
                            <span className="text-foreground font-medium">{usedSeats}</span>
                            <span className="text-muted-foreground"> of </span>
                            <span className="text-foreground font-medium">{seats}</span>
                            <span className="text-muted-foreground"> seats used</span>
                        </div>
                    </div>
                )}
            </div>

            {userRoleInOrg === OrgRole.OWNER && (
                <MemberApprovalRequiredToggle memberApprovalRequired={org.memberApprovalRequired} inviteLinkEnabled={org.inviteLinkEnabled} inviteLinkId={org.inviteLinkId} />
            )}

            <InviteMemberCard
                currentUserRole={userRoleInOrg}
                isBillingEnabled={IS_BILLING_ENABLED}
                seatsAvailable={seatsAvailable}
            />

            <Tabs value={currentTab}>
                <div className="border-b border-border w-full">
                    <TabSwitcher
                        className="h-auto p-0 bg-transparent"
                        tabs={[
                            { label: "Team Members", value: "members" },
                            ...(userRoleInOrg === OrgRole.OWNER ? [
                            {
                                label: (
                                    <div className="flex items-center gap-2">
                                        Pending Requests
                                        {requests.length > 0 && (
                                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                                                {requests.length}
                                            </span>
                                        )}
                                    </div>
                                ),
                                value: "requests"
                            },
                            {
                                label: (
                                    <div className="flex items-center gap-2">
                                        Pending Invites
                                        {invites.length > 0 && (
                                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                                                {invites.length}
                                            </span>
                                        )}
                                    </div>
                                ),
                                    value: "invites"
                                },
                            ] : []),
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

                {userRoleInOrg === OrgRole.OWNER && (
                    <>
                        <TabsContent value="requests">
                            <RequestsList
                                requests={requests}
                                currentUserRole={userRoleInOrg}
                            />
                        </TabsContent>

                        <TabsContent value="invites">
                            <InvitesList
                                invites={invites}
                                currentUserRole={userRoleInOrg}
                            />
                        </TabsContent>
                    </>
                )}
            </Tabs>
        </div>
    )
}
