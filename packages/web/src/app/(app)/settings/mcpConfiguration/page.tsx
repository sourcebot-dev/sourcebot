import { hasEntitlement } from "@/lib/entitlements";
import { authenticatedPage } from "@/middleware/authenticatedPage";
import { OrgRole } from "@sourcebot/db";
import { McpConfigurationPage } from "./mcpConfigurationPage";
import { McpConfigurationUnavailableMessage } from "./mcpConfigurationUnavailableMessage";

export default authenticatedPage(async () => {
    if (!(await hasEntitlement("oauth"))) {
        return <McpConfigurationUnavailableMessage />;
    }

    return <McpConfigurationPage />;
}, { minRole: OrgRole.OWNER, redirectTo: '/settings' });
