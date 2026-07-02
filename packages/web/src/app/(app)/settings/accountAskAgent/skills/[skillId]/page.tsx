import { notFound } from "next/navigation";
import { getPersonalAgentSkill } from "@/ee/features/chat/skills/actions";
import { PersonalSkillEditorPage } from "@/ee/features/chat/skills/components/personalSkillEditorPage";
import { hasEntitlement } from "@/lib/entitlements";
import { ErrorCode } from "@/lib/errorCodes";
import { ServiceErrorException } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { authenticatedPage } from "@/middleware/authenticatedPage";
import { AccountAskAgentEntitlementMessage } from "../../accountAskAgentEntitlementMessage";

interface PageProps extends Record<string, unknown> {
    params: Promise<{
        skillId: string;
    }>;
}

export default authenticatedPage<PageProps>(async (_context, { params }) => {
    // Skills are part of Ask Sourcebot. Gate the EE skill editor behind the
    // `ask` entitlement so it never renders on a non-entitled deployment.
    if (!(await hasEntitlement('ask'))) {
        return <AccountAskAgentEntitlementMessage />;
    }

    const { skillId } = await params;
    const skill = await getPersonalAgentSkill(skillId);
    if (isServiceError(skill)) {
        if (skill.errorCode === ErrorCode.AGENT_SKILL_NOT_FOUND) {
            return notFound();
        }
        throw new ServiceErrorException(skill);
    }

    return <PersonalSkillEditorPage skill={skill} />;
});
