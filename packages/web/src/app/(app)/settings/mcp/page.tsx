import { authenticatedPage } from "@/middleware/authenticatedPage";
import { getConnectedOauthClients } from "@/ee/features/oauth/actions";
import { ServiceErrorException } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { hasEntitlement } from "@/lib/entitlements";
import { env } from "@sourcebot/shared";
import { McpPage } from "./mcpPage";
import { McpEntitlementMessage } from "./mcpEntitlementMessage";

export default authenticatedPage(async () => {
    const hasMcpEntitlement = await hasEntitlement('mcp');

    /**
     * @note at the time of writing (May 26, 26'), the only type of
     * OAuth client we would expect are MCP clients. In a future where
     * we support other kinds of OAuth clients (e.g., CLI), we will
     * need to update our assumptions.
     */
    const connectedClients = await getConnectedOauthClients();
    if (isServiceError(connectedClients)) {
        throw new ServiceErrorException(connectedClients);
    }

    // The MCP server is a paid feature, but a downgraded deployment must still
    // be able to revoke previously-connected clients. So render the page when
    // entitled, or when there are connected clients to disconnect; otherwise
    // show the upgrade prompt. The page itself hides the setup surface (server
    // URL + install instructions) when the entitlement is absent.
    if (!hasMcpEntitlement && connectedClients.length === 0) {
        return <McpEntitlementMessage />;
    }

    const mcpServerUrl = `${env.AUTH_URL.replace(/\/$/, '')}/api/mcp`;

    return (
        <McpPage
            mcpServerUrl={mcpServerUrl}
            connectedClients={connectedClients}
            isMcpEnabled={hasMcpEntitlement}
        />
    )
});
