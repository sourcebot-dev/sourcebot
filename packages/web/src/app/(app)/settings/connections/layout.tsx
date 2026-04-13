import { authenticatedPage } from "@/middleware/authenticatedPage";
import { OrgRole } from "@sourcebot/db";

export default authenticatedPage<{ children: React.ReactNode }>(async (_auth, { children }) => {
    return <>{children}</>;
}, { minRole: OrgRole.OWNER, redirectTo: '/settings' });
