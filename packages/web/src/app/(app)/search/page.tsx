import { env } from "@sourcebot/shared";
import { auth } from "@/auth";
import { SearchLandingPage } from "./components/searchLandingPage";
import { SearchResultsPage } from "./components/searchResultsPage";
import { getConfiguredLanguageModelsInfo } from "@/features/chat/utils.server";
import { appendFileSync } from "node:fs";

interface SearchPageProps {
    searchParams: Promise<{
        query?: string;
        isRegexEnabled?: "true" | "false";
        isCaseSensitivityEnabled?: "true" | "false";
    }>;
}

export default async function SearchPage(props: SearchPageProps) {
    const searchParams = await props.searchParams;
    const query = searchParams?.query;
    const isRegexEnabled = searchParams?.isRegexEnabled === "true";
    const isCaseSensitivityEnabled = searchParams?.isCaseSensitivityEnabled === "true";
    const session = await auth();
    const showLoginWall = env.EXPERIMENT_ASK_GH_ENABLED === "true" && !session?.user;
    // #region agent log
    // eslint-disable-next-line react-hooks/purity -- temporary runtime instrumentation
    appendFileSync("/opt/cursor/logs/debug.log", JSON.stringify({ hypothesisId: "A,B", location: "search/page.tsx:showLoginWall", message: "Server computed search login wall", data: { envEnabled: env.EXPERIMENT_ASK_GH_ENABLED, hasSession: !!session, hasUser: !!session?.user, showLoginWall, processId: process.pid }, timestamp: Date.now() }) + "\n");
    // #endregion

    const languageModels = await getConfiguredLanguageModelsInfo();
    const isSearchAssistSupported = languageModels.length > 0;

    if (query === undefined || query.length === 0) {
        return (
            <SearchLandingPage
                isSearchAssistSupported={isSearchAssistSupported}
                showLoginWall={showLoginWall}
            />
        )
    }

    return (
        <SearchResultsPage
            searchQuery={query}
            defaultMaxMatchCount={env.DEFAULT_MAX_MATCH_COUNT}
            isRegexEnabled={isRegexEnabled}
            isCaseSensitivityEnabled={isCaseSensitivityEnabled}
            isSearchAssistSupported={isSearchAssistSupported}
            showLoginWall={showLoginWall}
        />
    )
}
