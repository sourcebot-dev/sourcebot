import { authenticatedPage } from "@/middleware/authenticatedPage";
import { getDefaultHomeView } from "@/lib/homeView";
import { env } from "@sourcebot/shared";
import { GeneralPage } from "./generalPage";

export default authenticatedPage(async ({ user }) => {
    return (
        <GeneralPage
            userName={user.name ?? undefined}
            userEmail={user.email ?? undefined}
            userImage={user.image ?? undefined}
            defaultHomeView={getDefaultHomeView(env.EXPERIMENT_ASK_GH_ENABLED === "true")}
        />
    );
});
