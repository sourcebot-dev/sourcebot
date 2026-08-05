import { listPersonalAgentSkills, listSharedAgentSkillCatalog } from "@/ee/features/chat/skills/actions";
import { SkillsPage } from "@/ee/features/chat/skills/components/skillsPage";
import { hasEntitlement } from "@/lib/entitlements";
import { ServiceErrorException } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { authenticatedPage } from "@/middleware/authenticatedPage";
import { OrgRole } from "@sourcebot/db";
import { env } from "@sourcebot/shared";
import { SkillsEntitlementMessage } from "./skillsEntitlementMessage";

interface PageProps extends Record<string, unknown> {
    // `skill` deep-links a specific skill as the initially-selected one (used by
    // the workspace admin table's skill-name links).
    searchParams: Promise<{ skill?: string }>;
}

export default authenticatedPage<PageProps>(async ({ user, role }, { searchParams }) => {
    // Skills are part of Ask Sourcebot. Gate the EE skill UI behind the `ask`
    // entitlement so it never renders on a non-entitled deployment; show the FSL
    // upsell panel instead.
    if (!(await hasEntitlement('ask'))) {
        return <SkillsEntitlementMessage />;
    }

    const [{ skill: initialSelectedId }, [personalSkills, sharedSkills]] = await Promise.all([
        searchParams,
        Promise.all([
            listPersonalAgentSkills(),
            listSharedAgentSkillCatalog(),
        ]),
    ]);
    if (isServiceError(personalSkills)) {
        throw new ServiceErrorException(personalSkills);
    }
    if (isServiceError(sharedSkills)) {
        throw new ServiceErrorException(sharedSkills);
    }

    return (
        <SkillsPage
            initialPersonalSkills={personalSkills}
            initialSharedSkills={sharedSkills}
            currentUserEmail={user.email ?? ""}
            isOwner={role === OrgRole.OWNER}
            initialSelectedId={initialSelectedId}
            permissionSyncEnabled={env.PERMISSION_SYNC_ENABLED === 'true'}
        />
    );
});
