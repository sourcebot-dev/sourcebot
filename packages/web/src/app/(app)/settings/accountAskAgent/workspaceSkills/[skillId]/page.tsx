import { notFound } from "next/navigation";
import { getOrgAgentSkill } from "@/ee/features/chat/skills/actions";
import { OrgSkillEditorPage } from "@/ee/features/chat/skills/components/personalSkillEditorPage";
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
    if (!(await hasEntitlement('ask'))) {
        return <AccountAskAgentEntitlementMessage />;
    }

    const { skillId } = await params;
    const skill = await getOrgAgentSkill(skillId);
    if (isServiceError(skill)) {
        if (
            skill.errorCode === ErrorCode.AGENT_SKILL_NOT_FOUND ||
            skill.errorCode === ErrorCode.INSUFFICIENT_PERMISSIONS
        ) {
            return notFound();
        }
        throw new ServiceErrorException(skill);
    }

    return <OrgSkillEditorPage skill={skill} />;
});
