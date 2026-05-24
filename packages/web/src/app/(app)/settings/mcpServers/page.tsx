import { McpServersPage } from "./mcpServersPage";
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
    const { status, server, message } = await searchParams;
    return (
        <McpServersPage
            callbackStatus={status}
            callbackServer={server}
            callbackMessage={message}
            canManageMcpServers={role === OrgRole.OWNER}
        />
    );
});
