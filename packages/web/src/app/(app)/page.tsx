import { HOME_VIEW_COOKIE_NAME } from "@/lib/constants";
import { resolveHomeView } from "@/features/homeView/homeView";
import { authenticatedPage } from "@/middleware/authenticatedPage";
import { cookies } from "next/headers";
import { ChatLandingPage } from "./chat/chatLandingPage";
import SearchPage from "./search/page";

interface Props extends Record<string, unknown> {
    searchParams: Promise<{ query?: string }>;
}

export default authenticatedPage<Props>(async ({ org }, props) => {
    const cookieStore = await cookies();
    const homeView = resolveHomeView({
        personalPreference: cookieStore.get(HOME_VIEW_COOKIE_NAME)?.value,
        orgDefault: org.defaultHomeView,
    });

    if (homeView === "ask") {
        return <ChatLandingPage />;
    }

    return <SearchPage {...props} />;
}, { allowAnonymous: true });
