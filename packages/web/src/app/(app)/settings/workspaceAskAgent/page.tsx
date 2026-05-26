import { hasEntitlement } from "@/lib/entitlements";
import { authenticatedPage } from "@/middleware/authenticatedPage";
import { OrgRole } from "@sourcebot/db";
import { WorkspaceAskAgentPage } from "./workspaceAskAgentPage";
import { WorkspaceAskAgentUnavailableMessage } from "./workspaceAskAgentUnavailableMessage";

export default authenticatedPage(async ({ org, prisma }) => {
    if (!(await hasEntitlement("oauth"))) {
        const serverCount = await prisma.mcpServer.count({
            where: { orgId: org.id },
        });

        if (serverCount === 0) {
            return <WorkspaceAskAgentUnavailableMessage />;
        }
    }

    return <WorkspaceAskAgentPage />;
}, { minRole: OrgRole.OWNER, redirectTo: '/settings' });
