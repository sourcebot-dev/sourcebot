import { HOME_VIEW_COOKIE_NAME } from "@/lib/constants";
import type { HomeView } from "@/lib/homeView";
import { cookies } from "next/headers";
import { ChatLandingPage } from "./chat/chatLandingPage";
import SearchPage from "./search/page";
import { env } from "@sourcebot/shared";

interface Props {
    searchParams: Promise<{ query?: string }>;
}

export default async function Home(props: Props) {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(HOME_VIEW_COOKIE_NAME)?.value as HomeView | undefined;
    const homeView = cookieValue ?? env.DEFAULT_HOME_VIEW_PAGE;
    if (homeView === "ask") {
        return <ChatLandingPage />;
    }

    return <SearchPage {...props} />;
}
