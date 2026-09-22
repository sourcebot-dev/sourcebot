import { HOME_VIEW_COOKIE_NAME } from "@/lib/constants";
import { getDefaultHomeView, resolveHomeView } from "@/lib/homeView";
import { cookies } from "next/headers";
import { ChatLandingPage } from "./chat/chatLandingPage";
import SearchPage from "./search/page";
import { env } from "@sourcebot/shared";

interface Props {
    searchParams: Promise<{ query?: string }>;
}

export default async function Home(props: Props) {
    const cookieStore = await cookies();
    const defaultHomeView = getDefaultHomeView(env.EXPERIMENT_ASK_GH_ENABLED === "true");
    const homeView = resolveHomeView(
        cookieStore.get(HOME_VIEW_COOKIE_NAME)?.value,
        defaultHomeView,
    );
    if (homeView === "ask") {
        return <ChatLandingPage />;
    }

    return <SearchPage {...props} />;
}
