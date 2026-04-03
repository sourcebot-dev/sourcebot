import { notFound } from "next/navigation";
import { OrgRole } from "@sourcebot/db";
import { env } from "@sourcebot/shared";
import { authenticatedPage } from "@/middleware/authenticatedPage";

export default authenticatedPage<{ children: React.ReactNode }>(async ({ role }, { children }) => {
    if (env.DISABLE_API_KEY_USAGE_FOR_NON_OWNER_USERS === 'true' && role !== OrgRole.OWNER) {
        return notFound();
    }

    return <>{children}</>;
});
