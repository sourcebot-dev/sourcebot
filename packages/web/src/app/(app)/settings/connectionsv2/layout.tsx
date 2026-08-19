import { authenticatedPage } from "@/middleware/authenticatedPage";
import { OrgRole } from "@sourcebot/db";
import { SettingsContainer } from "../components/settingsContainer";

export default authenticatedPage<{ children: React.ReactNode }>(
    async (_auth, { children }) => (
        <SettingsContainer>{children}</SettingsContainer>
    ),
    { minRole: OrgRole.OWNER, redirectTo: "/settings" },
);
