import { hasEntitlement } from "@/lib/entitlements";
import { authenticatedPage } from "@/middleware/authenticatedPage";
import { OrgRole } from "@sourcebot/db";
import { getMcpOAuthCallbackUrl } from "@/ee/features/chat/mcp/mcpOAuthCallbackUrl";
import { WorkspaceAskAgentPage } from "./workspaceAskAgentPage";
import { WorkspaceAskAgentEntitlementMessage } from "./workspaceAskAgentEntitlementMessage";

interface PageProps extends Record<string, unknown> {
    searchParams: Promise<{
        status?: string;
        server?: string;
        message?: string;
    }>;
}

export default authenticatedPage<PageProps>(async ({ org, prisma }, { searchParams }) => {
    // Adding connectors requires the `ask` entitlement. But a downgraded
    // workspace must still be able to view and remove previously-configured
    // connectors, so this page lives in FSL: when connectors already exist we
    // render it for teardown (the page itself disables "add" and only allows
    // removal in that state). We only show the upsell when there is nothing to
    // clean up.
    if (!(await hasEntitlement("ask"))) {
        const serverCount = await prisma.mcpServer.count({
            where: { orgId: org.id },
        });

        if (serverCount === 0) {
            return <WorkspaceAskAgentEntitlementMessage />;
        }
    }

    const { status, server, message } = await searchParams;

    return (
        <WorkspaceAskAgentPage
            callbackStatus={status}
            callbackServer={server}
            callbackMessage={message}
            oauthRedirectUrl={getMcpOAuthCallbackUrl()}
        />
    );
}, { minRole: OrgRole.OWNER, redirectTo: '/settings' });
