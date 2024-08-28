'use client';

import { Input } from "@/components/ui/input";
import { ZoektResult, ZoektSearchResponse } from "@/lib/types";
import { useEffect } from "react";
import { useDebouncedCallback } from "use-debounce";

interface SearchBarProps {
    query: string;
    numResults: number;
    onLoadingChange: (isLoading: boolean) => void;
    onQueryChange: (query: string) => void;
    onSearchResult: (result?: ZoektResult) => void,
}

export const SearchBar = ({
    query,
    numResults,
    onLoadingChange,
    onQueryChange,
    onSearchResult,
}: SearchBarProps) => {
    const SEARCH_DEBOUNCE_MS = 200;

    // @todo : we should probably be cancelling any running requests
    const search = useDebouncedCallback((query: string) => {
        if (query === "") {
            onSearchResult(undefined);
            return;
        }
        console.log('making query...');

        onLoadingChange(true);
        fetch(`http://localhost:3000/api/search?query=${query}&numResults=${numResults}`)
            .then(response => response.json())
            .then(({ data }: { data: ZoektSearchResponse }) => {
                onSearchResult(data.result);
            })
            // @todo : error handling
            .catch(error => {
                console.error('Error:', error);
            }).finally(() => {
                console.log('done making query');
                onLoadingChange(false);
            });
    }, SEARCH_DEBOUNCE_MS);

    useEffect(() => {
        search(query);
    }, [query]);

    return (
        <Input
            value={query}
            className="w-full h-8"
            placeholder="Search..."
            onChange={(e) => {
                const query = e.target.value;
                onQueryChange(query);
            }}
        />
    )
}