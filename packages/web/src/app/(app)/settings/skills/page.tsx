import { listPersonalAgentSkills, listSharedAgentSkillCatalog } from "@/ee/features/chat/skills/actions";
import { SkillsPage } from "@/ee/features/chat/skills/components/skillsPage";
import { hasEntitlement } from "@/lib/entitlements";
import { ServiceErrorException } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { authenticatedPage } from "@/middleware/authenticatedPage";
import { OrgRole } from "@sourcebot/db";
import { SkillsEntitlementMessage } from "./skillsEntitlementMessage";

export default authenticatedPage(async ({ user, role }) => {
    // Skills are part of Ask Sourcebot. Gate the EE skill UI behind the `ask`
    // entitlement so it never renders on a non-entitled deployment; show the FSL
    // upsell panel instead.
    if (!(await hasEntitlement('ask'))) {
        return <SkillsEntitlementMessage />;
    }

    const [personalSkills, sharedSkills] = await Promise.all([
        listPersonalAgentSkills(),
        listSharedAgentSkillCatalog(),
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
        />
    );
});
