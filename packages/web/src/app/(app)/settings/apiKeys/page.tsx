import { env } from "@sourcebot/shared";
import { OrgRole } from "@sourcebot/db";
import { ApiKeysPage } from "./apiKeysPage";
import { authenticatedPage } from "@/middleware/authenticatedPage";
import { getUserApiKeys } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { ServiceErrorException } from "@/lib/serviceError";

export default authenticatedPage(async ({ role }) => {
    let canCreateApiKey = true;
    if (env.DISABLE_API_KEY_CREATION_FOR_NON_OWNER_USERS === 'true') {
        canCreateApiKey = role === OrgRole.OWNER;
    }

    const apiKeys = await getUserApiKeys();
    if (isServiceError(apiKeys)) {
        throw new ServiceErrorException(apiKeys);
    }

    return <ApiKeysPage canCreateApiKey={canCreateApiKey} apiKeys={apiKeys} />;
});
