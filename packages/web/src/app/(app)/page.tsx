import SearchPage from "./search/page";

interface Props {
    searchParams: Promise<{ query?: string }>;
}

export default async function Home(props: Props) {
    // Default to rendering the search page.
    return <SearchPage {...props} />;
}