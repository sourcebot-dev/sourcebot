import { getMe } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { env } from "@sourcebot/shared";
import { OrgRole } from "@sourcebot/db";
import { getOrgFromDomain } from "@/data/org";
import { ApiKeysPage } from "./apiKeysPage";

export default async function Page({ params }: { params: Promise<{ domain: string }> }) {
    const { domain } = await params;

    let canCreateApiKey = true;
    if (env.DISABLE_API_KEY_CREATION_FOR_NON_OWNER_USERS === 'true') {
        const [org, me] = await Promise.all([getOrgFromDomain(domain), getMe()]);
        if (org && !isServiceError(me)) {
            const role = me.memberships.find((m) => m.id === org.id)?.role;
            canCreateApiKey = role === OrgRole.OWNER;
        }
    }

    return <ApiKeysPage canCreateApiKey={canCreateApiKey} />;
}
