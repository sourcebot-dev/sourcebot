import { env } from "@sourcebot/shared";
import { SearchLandingPage } from "./components/searchLandingPage";
import { SearchResultsPage } from "./components/searchResultsPage";
import { auth } from "@/auth";

interface SearchPageProps {
    params: Promise<{ domain: string }>;
    searchParams: Promise<{
        query?: string;
        isRegexEnabled?: "true" | "false";
        isCaseSensitivityEnabled?: "true" | "false";
    }>;
}

export default async function SearchPage(props: SearchPageProps) {
    const { domain } = await props.params;
    const searchParams = await props.searchParams;
    const query = searchParams?.query;
    const isRegexEnabled = searchParams?.isRegexEnabled === "true";
    const isCaseSensitivityEnabled = searchParams?.isCaseSensitivityEnabled === "true";

    const session = await auth();

    if (query === undefined || query.length === 0) {
        return <SearchLandingPage domain={domain} />
    }

    return (
        <SearchResultsPage
            searchQuery={query}
            defaultMaxMatchCount={env.DEFAULT_MAX_MATCH_COUNT}
            isRegexEnabled={isRegexEnabled}
            isCaseSensitivityEnabled={isCaseSensitivityEnabled}
            session={session}
        />
    )
}
