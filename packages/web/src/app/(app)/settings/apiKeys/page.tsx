import { getMe } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { env } from "@sourcebot/shared";
import { OrgRole } from "@sourcebot/db";
import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";
import { prisma } from "@/prisma";
import { ApiKeysPage } from "./apiKeysPage";

export default async function Page() {
    let canCreateApiKey = true;
    if (env.DISABLE_API_KEY_CREATION_FOR_NON_OWNER_USERS === 'true') {
        const [org, me] = await Promise.all([prisma.org.findUnique({ where: { id: SINGLE_TENANT_ORG_ID } }), getMe()]);
        if (org && !isServiceError(me)) {
            const role = me.memberships.find((m) => m.id === org.id)?.role;
            canCreateApiKey = role === OrgRole.OWNER;
        }
    }

    return <ApiKeysPage canCreateApiKey={canCreateApiKey} />;
}
