import { authenticatedPage } from "@/middleware/authenticatedPage";
import { env } from "@sourcebot/shared";
import { GeneralPage } from "./generalPage";

export default authenticatedPage(async ({ user }) => {
    return (
        <GeneralPage
            userName={user.name ?? undefined}
            userEmail={user.email ?? undefined}
            userImage={user.image ?? undefined}
            defaultHomeView={env.DEFAULT_HOME_VIEW_PAGE}
        />
    );
});
