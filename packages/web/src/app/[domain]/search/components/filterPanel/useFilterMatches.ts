'use client';

import { SearchResultFile } from "@/features/search";
import {  useMemo } from "react";
import { useGetSelectedFromQuery } from "./useGetSelectedFromQuery";

export const LANGUAGES_QUERY_PARAM = "langs";
export const REPOS_QUERY_PARAM = "repos";


export const useFilteredMatches = (
    matches: SearchResultFile[],
    filterBy: 'repository' | 'language' | 'all' = 'all'
) => {
    const { getSelectedFromQuery } = useGetSelectedFromQuery();

    const filteredMatches = useMemo(() => {
        const selectedRepos = getSelectedFromQuery(REPOS_QUERY_PARAM);
        const selectedLanguages = getSelectedFromQuery(LANGUAGES_QUERY_PARAM);

        const isInRepoSet = (repo: string) => selectedRepos.size === 0 || selectedRepos.has(repo);
        const isInLanguageSet = (language: string) => selectedLanguages.size === 0 || selectedLanguages.has(language);

        switch (filterBy) {
            case 'repository':
                return matches.filter((match) => isInRepoSet(match.repository));
            case 'language':
                return matches.filter((match) => isInLanguageSet(match.language));
            case 'all':
                return matches.filter((match) => isInRepoSet(match.repository) && isInLanguageSet(match.language));
        }

    }, [filterBy, getSelectedFromQuery, matches]);

    return filteredMatches;
}
