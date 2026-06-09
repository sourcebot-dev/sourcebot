import { AccountAskAgentPage } from "@/ee/features/chat/mcp/components/accountAskAgentPage";
import { AccountAskAgentEntitlementMessage } from "./accountAskAgentEntitlementMessage";
import { listPersonalAgentSkills } from "@/ee/features/chat/skills/actions";
import { hasEntitlement } from "@/lib/entitlements";
import { ServiceErrorException } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { authenticatedPage } from "@/middleware/authenticatedPage";
import { OrgRole } from "@sourcebot/db";

interface PageProps extends Record<string, unknown> {
    searchParams: Promise<{
        status?: string;
        server?: string;
        message?: string;
    }>;
}

export default authenticatedPage<PageProps>(async ({ role }, { searchParams }) => {
    // Connectors are part of Ask Sourcebot. Gate the EE connector UI
    // behind the `ask` entitlement here so it never renders or executes on a
    // non-entitled deployment; show the FSL upsell panel instead.
    if (!(await hasEntitlement('ask'))) {
        return <AccountAskAgentEntitlementMessage />;
    }

    const { status, server, message } = await searchParams;
    const personalSkills = await listPersonalAgentSkills();
    if (isServiceError(personalSkills)) {
        throw new ServiceErrorException(personalSkills);
    }

    return (
        <AccountAskAgentPage
            callbackStatus={status}
            callbackServer={server}
            callbackMessage={message}
            canManageConnectors={role === OrgRole.OWNER}
            initialPersonalSkills={personalSkills}
        />
    );
});
