import { authenticatedPage } from "@/middleware/authenticatedPage";
import { parseHomeView } from "@/features/homeView/homeView";
import { GeneralPage } from "./generalPage";

export default authenticatedPage(async ({ org, user }) => {
    return (
        <GeneralPage
            userName={user.name ?? undefined}
            userEmail={user.email ?? undefined}
            userImage={user.image ?? undefined}
            orgDefaultHomeView={parseHomeView(org.defaultHomeView) ?? "search"}
        />
    );
});
