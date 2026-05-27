import { authenticatedPage } from "@/middleware/authenticatedPage";
import { getConnectedOauthClients } from "@/ee/features/oauth/actions";
import { ServiceErrorException } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { env } from "@sourcebot/shared";
import { McpPage } from "./mcpPage";

export default authenticatedPage(async () => {
    const mcpServerUrl = `${env.AUTH_URL.replace(/\/$/, '')}/api/mcp`;

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

    return (
        <McpPage
            mcpServerUrl={mcpServerUrl}
            connectedClients={connectedClients}
        />
    )
});
