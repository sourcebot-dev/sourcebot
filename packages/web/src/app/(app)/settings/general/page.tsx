import { authenticatedPage } from "@/middleware/authenticatedPage";
import { getDefaultHomeView } from "@/lib/homeView.server";
import { GeneralPage } from "./generalPage";

export default authenticatedPage(async ({ user }) => {
    return (
        <GeneralPage
            userName={user.name ?? undefined}
            userEmail={user.email ?? undefined}
            userImage={user.image ?? undefined}
            defaultHomeView={getDefaultHomeView()}
        />
    );
});
