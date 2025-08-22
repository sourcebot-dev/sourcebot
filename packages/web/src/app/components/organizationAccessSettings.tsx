import { createInviteLink, getBaseUrl } from "@/lib/utils"
import { AnonymousAccessToggle } from "./anonymousAccessToggle"
import { OrganizationAccessSettingsWrapper } from "./organizationAccessSettingsWrapper"
import { getOrgFromDomain } from "@/data/org"
import { getOrgMetadata } from "@/lib/utils"
import { headers } from "next/headers"
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants"
import { hasEntitlement } from "@sourcebot/shared"
import { env } from "@/env.mjs"

export async function OrganizationAccessSettings() {
    const org = await getOrgFromDomain(SINGLE_TENANT_ORG_DOMAIN);
    if (!org) {
        return <div>Error loading organization</div>
    }

    const metadata = getOrgMetadata(org);
    const anonymousAccessEnabled = metadata?.anonymousAccessEnabled ?? false;

    const headersList = await headers();
    const baseUrl = getBaseUrl(headersList);
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
        </div>
    )
}