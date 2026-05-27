import { hasEntitlement } from "@/lib/entitlements";
import { authenticatedPage } from "@/middleware/authenticatedPage";
import { OrgRole } from "@sourcebot/db";
import { WorkspaceAskAgentPage } from "./workspaceAskAgentPage";
import { WorkspaceAskAgentUnavailableMessage } from "./workspaceAskAgentUnavailableMessage";

interface PageProps extends Record<string, unknown> {
    searchParams: Promise<{
        status?: string;
        server?: string;
        message?: string;
    }>;
}

export default authenticatedPage<PageProps>(async ({ org, prisma }, { searchParams }) => {
    if (!(await hasEntitlement("oauth"))) {
        const serverCount = await prisma.mcpServer.count({
            where: { orgId: org.id },
        });

        if (serverCount === 0) {
            return <WorkspaceAskAgentUnavailableMessage />;
        }
    }

    const { status, server, message } = await searchParams;

    return (
        <WorkspaceAskAgentPage
            callbackStatus={status}
            callbackServer={server}
            callbackMessage={message}
        />
    );
}, { minRole: OrgRole.OWNER, redirectTo: '/settings' });
