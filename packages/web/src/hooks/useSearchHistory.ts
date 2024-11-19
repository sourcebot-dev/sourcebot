'use client';

import { useMemo } from "react";
import { useLocalStorage } from "usehooks-ts";

type Search = {
    query: string;
    date: string;
}

export const useSearchHistory = () => {
    const [_searchHistory, setSearchHistory] = useLocalStorage<Search[]>("searchHistory", []);

    const searchHistory = useMemo(() => {
        return _searchHistory.toSorted((a, b) => {
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
    }, [_searchHistory]);

    return {
        searchHistory,
        setSearchHistory,
    }
}