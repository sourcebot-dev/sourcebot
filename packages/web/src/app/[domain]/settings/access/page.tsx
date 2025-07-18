import { getOrgFromDomain } from "@/data/org";
import { getAnonymousAccessStatus } from "@/actions";
import { hasEntitlement } from "@sourcebot/shared";
import { isServiceError, getBaseUrl, createInviteLink } from "@/lib/utils";
import { headers } from "next/headers";
import { OrganizationAccessSettings } from "@/app/components/organizationAccessSettings";

interface AccessPageProps {
    params: {
        domain: string;
    }
}

export default async function AccessPage({ params: { domain } }: AccessPageProps) {
    const org = await getOrgFromDomain(domain);
    if (!org) {
        throw new Error("Organization not found");
    }

    // Get the current URL to construct the full invite link
    const headersList = headers();
    const baseUrl = getBaseUrl(headersList);
    const inviteLink = createInviteLink(baseUrl, org.inviteLinkId);

    // Get anonymous access status
    const anonymousAccessEntitlement = hasEntitlement("anonymous-access");
    const anonymousAccessStatus = await getAnonymousAccessStatus(domain);
    const anonymousAccessEnabled = anonymousAccessEntitlement && !isServiceError(anonymousAccessStatus) && anonymousAccessStatus;

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-lg font-medium">Access Control</h3>
                <p className="text-sm text-muted-foreground">Configure how users can access your Sourcebot deployment.</p>
            </div>

            <OrganizationAccessSettings 
                anonymousAccessEnabled={anonymousAccessEnabled} 
                memberApprovalRequired={org.memberApprovalRequired} 
                inviteLinkEnabled={org.inviteLinkEnabled} 
                inviteLink={inviteLink} 
            />
        </div>
    )
}