import { AccountAskAgentPage } from "./accountAskAgentPage";
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
        <AccountAskAgentPage
            callbackStatus={status}
            callbackServer={server}
            callbackMessage={message}
            canManageConnectors={role === OrgRole.OWNER}
        />
    );
});
