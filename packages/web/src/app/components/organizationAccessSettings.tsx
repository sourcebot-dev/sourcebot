import { createInviteLink } from "@/lib/utils"
import { AnonymousAccessToggle } from "./anonymousAccessToggle"
import { UpgradeToastToggle } from "./upgradeToastToggle"
import { OrganizationAccessSettingsWrapper } from "./organizationAccessSettingsWrapper"
import { getOrgFromDomain } from "@/data/org"
import { getOrgMetadata } from "@/lib/utils"
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants"
import { hasEntitlement, env } from "@sourcebot/shared"

export async function OrganizationAccessSettings() {
    const org = await getOrgFromDomain(SINGLE_TENANT_ORG_DOMAIN);
    if (!org) {
        return <div>Error loading organization</div>
    }

    const metadata = getOrgMetadata(org);
    const anonymousAccessEnabled = metadata?.anonymousAccessEnabled ?? false;
    const upgradeToastEnabled = metadata?.upgradeToastEnabled ?? true;

    const baseUrl = env.AUTH_URL;
    const inviteLink = createInviteLink(baseUrl, org.inviteLinkId)

    const hasAnonymousAccessEntitlement = hasEntitlement("anonymous-access");

    const forceEnableAnonymousAccess = env.FORCE_ENABLE_ANONYMOUS_ACCESS === 'true';

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
            />

            <UpgradeToastToggle
                upgradeToastEnabled={upgradeToastEnabled}
            />

        </div>
    )
}