import { env } from "@sourcebot/shared";
import { auth } from "@/auth";
import { SearchLandingPage } from "./components/searchLandingPage";
import { SearchResultsPage } from "./components/searchResultsPage";
import { getConfiguredLanguageModelsInfo } from "@/features/chat/utils.server";

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
    const isAuthenticated = !!session?.user;
    const isLoginWallEnabled = env.EXPERIMENT_ASK_GH_ENABLED === "true";

    const languageModels = await getConfiguredLanguageModelsInfo();
    const isSearchAssistSupported = languageModels.length > 0;

    if (query === undefined || query.length === 0) {
        return (
            <SearchLandingPage
                isAuthenticated={isAuthenticated}
                isLoginWallEnabled={isLoginWallEnabled}
                isSearchAssistSupported={isSearchAssistSupported}
            />
        )
    }

    return (
        <SearchResultsPage
            isAuthenticated={isAuthenticated}
            searchQuery={query}
            defaultMaxMatchCount={env.DEFAULT_MAX_MATCH_COUNT}
            isRegexEnabled={isRegexEnabled}
            isCaseSensitivityEnabled={isCaseSensitivityEnabled}
            isLoginWallEnabled={isLoginWallEnabled}
            isSearchAssistSupported={isSearchAssistSupported}
        />
    )
}
