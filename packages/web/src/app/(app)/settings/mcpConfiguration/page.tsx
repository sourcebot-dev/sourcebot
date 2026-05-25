import { hasEntitlement } from "@/lib/entitlements";
import { authenticatedPage } from "@/middleware/authenticatedPage";
import { OrgRole } from "@sourcebot/db";
import { McpConfigurationPage } from "./mcpConfigurationPage";
import { McpConfigurationUnavailableMessage } from "./mcpConfigurationUnavailableMessage";

export default authenticatedPage(async ({ org, prisma }) => {
    if (!(await hasEntitlement("oauth"))) {
        const serverCount = await prisma.mcpServer.count({
            where: { orgId: org.id },
        });

        if (serverCount === 0) {
            return <McpConfigurationUnavailableMessage />;
        }
    }

    return <McpConfigurationPage />;
}, { minRole: OrgRole.OWNER, redirectTo: '/settings' });
