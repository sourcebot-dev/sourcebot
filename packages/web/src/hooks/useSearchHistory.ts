'use client';

import { useLocalStorage } from "usehooks-ts";

export const useSearchHistory = () => {
    const [searchHistory, setSearchHistory] = useLocalStorage<string[]>("searchHistory", []);
    return {
        searchHistory,
        setSearchHistory,
    }
}