import { HOME_VIEW_COOKIE_NAME } from "@/lib/constants";
import { resolveHomeView } from "@/lib/homeView";
import { getDefaultHomeView } from "@/lib/homeView.server";
import { cookies } from "next/headers";
import { ChatLandingPage } from "./chat/chatLandingPage";
import SearchPage from "./search/page";

interface Props {
    searchParams: Promise<{ query?: string }>;
}

export default async function Home(props: Props) {
    const cookieStore = await cookies();
    const defaultHomeView = getDefaultHomeView();
    const homeView = resolveHomeView(
        cookieStore.get(HOME_VIEW_COOKIE_NAME)?.value,
        defaultHomeView,
    );
    if (homeView === "ask") {
        return <ChatLandingPage />;
    }

    return <SearchPage {...props} />;
}
