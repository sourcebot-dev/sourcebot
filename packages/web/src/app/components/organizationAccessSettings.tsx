import { createInviteLink, getBaseUrl } from "@/lib/utils"
import { AnonymousAccessToggle } from "./anonymousAccessToggle"
import { OrganizationAccessSettingsWrapper } from "./organizationAccessSettingsWrapper"
import { getOrgFromDomain } from "@/data/org"
import { getOrgMetadata } from "@/types"
import { headers } from "next/headers"
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants"
import { hasEntitlement, loadConfig } from "@sourcebot/shared"
import { env } from "@/env.mjs"
import { createLogger } from "@sourcebot/logger";

const logger = createLogger("OrganizationAccessSettings");

export async function OrganizationAccessSettings() {
    const org = await getOrgFromDomain(SINGLE_TENANT_ORG_DOMAIN);
    if (!org) {
        return <div>Error loading organization</div>
    }

    const metadata = getOrgMetadata(org);
    const anonymousAccessEnabled = metadata?.anonymousAccessEnabled ?? false;

    const headersList = headers();
    const baseUrl = getBaseUrl(headersList);
    const inviteLink = createInviteLink(baseUrl, org.inviteLinkId)

    const hasAnonymousAccessEntitlement = hasEntitlement("anonymous-access");

    let forceEnableAnonymousAccess = false;
    if (env.CONFIG_PATH) {
        const config = await loadConfig(env.CONFIG_PATH);
        forceEnableAnonymousAccess = config.settings?.forceEnableAnonymousAccess ?? false;
    } else {
        logger.warn("CONFIG_PATH is not set, so forceEnableAnonymousAccess will be false");
    }

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
                anonymousAccessEnabled={anonymousAccessEnabled}
            />
        </div>
    )
}