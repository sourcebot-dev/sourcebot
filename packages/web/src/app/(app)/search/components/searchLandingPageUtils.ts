export const buildQueryExampleHref = ({
    query,
    isCaseSensitivityEnabled = false,
}: {
    query: string;
    isCaseSensitivityEnabled?: boolean;
}) => {
    const searchParams = new URLSearchParams({
        query,
    });

    if (isCaseSensitivityEnabled) {
        searchParams.set("isCaseSensitivityEnabled", "true");
    }

    return `/search?${searchParams.toString()}`;
}
