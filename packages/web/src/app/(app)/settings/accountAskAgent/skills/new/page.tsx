import { PersonalSkillEditorPage } from "@/ee/features/chat/skills/components/personalSkillEditorPage";
import { hasEntitlement } from "@/lib/entitlements";
import { authenticatedPage } from "@/middleware/authenticatedPage";
import { AccountAskAgentEntitlementMessage } from "../../accountAskAgentEntitlementMessage";

export default authenticatedPage(async () => {
    // Skills are part of Ask Sourcebot. Gate the EE skill editor behind the
    // `ask` entitlement so it never renders on a non-entitled deployment.
    if (!(await hasEntitlement('ask'))) {
        return <AccountAskAgentEntitlementMessage />;
    }

    return <PersonalSkillEditorPage skill={null} />;
});
