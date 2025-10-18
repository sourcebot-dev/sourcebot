import { SearchLandingPage } from "./components/searchLandingPage";
import { SearchResultsPage } from "./components/searchResultsPage";

interface SearchPageProps {
    params: Promise<{ domain: string }>;
    searchParams: Promise<{ query?: string }>;
}

export default async function SearchPage(props: SearchPageProps) {
    const { domain } = await props.params;
    const searchParams = await props.searchParams;
    const query = searchParams?.query;

    if (query === undefined || query.length === 0) {
        return <SearchLandingPage domain={domain} />
    }

    return (
        <SearchResultsPage
            searchQuery={query}
        />
    )
}
