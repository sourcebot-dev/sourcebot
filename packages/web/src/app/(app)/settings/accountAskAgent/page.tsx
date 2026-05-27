import { AccountAskAgentPage } from "./accountAskAgentPage";
import { hasEntitlement } from "@/lib/entitlements";
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
    const isOAuthAvailable = await hasEntitlement('oauth');

    return (
        <AccountAskAgentPage
            callbackStatus={status}
            callbackServer={server}
            callbackMessage={message}
            canManageConnectors={role === OrgRole.OWNER}
            isOAuthAvailable={isOAuthAvailable}
        />
    );
});
