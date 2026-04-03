import { env } from "@sourcebot/shared";
import { OrgRole } from "@sourcebot/db";
import { ApiKeysPage } from "./apiKeysPage";
import { authenticatedPage } from "@/middleware/authenticatedPage";

export default authenticatedPage(async ({ role }) => {
    let canCreateApiKey = true;
    if (env.DISABLE_API_KEY_CREATION_FOR_NON_OWNER_USERS === 'true') {
        canCreateApiKey = role === OrgRole.OWNER;
    }

    return <ApiKeysPage canCreateApiKey={canCreateApiKey} />;
});
