import { createInviteLink } from "@/lib/utils"
import { AnonymousAccessToggle } from "./anonymousAccessToggle"
import { OrganizationAccessSettingsWrapper } from "./organizationAccessSettingsWrapper"
import { getOrgMetadata } from "@/lib/utils"
import { SINGLE_TENANT_ORG_ID } from "@/lib/constants"
import { __unsafePrisma } from "@/prisma"
import { env } from "@sourcebot/shared"
import { hasEntitlement } from "@/lib/entitlements"

export async function OrganizationAccessSettings() {
    const org = await __unsafePrisma.org.findUnique({ where: { id: SINGLE_TENANT_ORG_ID } });
    if (!org) {
        return <div>Error loading organization</div>
    }

    const metadata = getOrgMetadata(org);
    const anonymousAccessEnabled = metadata?.anonymousAccessEnabled ?? false;

    const baseUrl = env.AUTH_URL;
    const inviteLink = createInviteLink(baseUrl, org.inviteLinkId)

    const hasAnonymousAccessEntitlement = await hasEntitlement("anonymous-access");

    const forceEnableAnonymousAccess = env.FORCE_ENABLE_ANONYMOUS_ACCESS === 'true';
    const memberApprovalEnvVarSet = env.REQUIRE_APPROVAL_NEW_MEMBERS !== undefined;

    return (
        <div className="space-y-6">
            <AnonymousAccessToggle
                hasAnonymousAccessEntitlement={hasAnonymousAccessEntitlement}
                anonymousAccessEnabled={anonymousAccessEnabled}
                forceEnableAnonymousAccess={forceEnableAnonymousAccess}
            />

            <OrganizationAccessSettingsWrapper
                memberApprovalRequired={org.memberApprovalRequired}
                inviteLinkEnabled={org.inviteLinkEnabled}
                inviteLink={inviteLink}
                memberApprovalEnvVarSet={memberApprovalEnvVarSet}
            />
        </div>
    )
}