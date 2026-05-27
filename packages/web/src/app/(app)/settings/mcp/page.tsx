import { authenticatedPage } from "@/middleware/authenticatedPage";
import { getConnectedMcpClients } from "@/ee/features/oauth/actions";
import { ServiceErrorException } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { env } from "@sourcebot/shared";
import { McpPage } from "./mcpPage";

export default authenticatedPage(async () => {
    const mcpServerUrl = `${env.AUTH_URL.replace(/\/$/, '')}/api/mcp`;

    const connectedClients = await getConnectedMcpClients();
    if (isServiceError(connectedClients)) {
        throw new ServiceErrorException(connectedClients);
    }

    return <McpPage mcpServerUrl={mcpServerUrl} connectedClients={connectedClients} />;
});
