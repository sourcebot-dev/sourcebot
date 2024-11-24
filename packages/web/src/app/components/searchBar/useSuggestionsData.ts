'use client';

import { useQuery } from "@tanstack/react-query";
import { Suggestion, SuggestionMode } from "./searchSuggestionsBox";
import { getRepos, search } from "@/app/api/(client)/client";
import { useMemo } from "react";
import languages from "./languages";

interface Props {
    suggestionMode: SuggestionMode;
    suggestionQuery: string;
}

/**
 * Fetches suggestions for the search bar.
 */
export const useSuggestionsData = ({
    suggestionMode,
    suggestionQuery,
}: Props) => {
    const { data: repoSuggestions } = useQuery({
        queryKey: ["repoSuggestions"],
        queryFn: getRepos,
        select: (data): Suggestion[] => {
            return data.List.Repos
                .map(r => r.Repository)
                .map(r => ({
                    value: r.Name
                }));
        },
        enabled: suggestionMode === "repo",
    });

    const { data: fileSuggestions } = useQuery({
        queryKey: ["fileSuggestions", suggestionQuery],
        queryFn: () => search({
            query: `file:${suggestionQuery}`,
            maxMatchDisplayCount: 15,
        }),
        select: (data): Suggestion[] => {
            return data.Result.Files?.map((file) => ({
                value: file.FileName
            })) ?? [];
        },
        enabled: suggestionMode === "file"
    });

    const languageSuggestions = useMemo((): Suggestion[] => {
        return languages.map((lang) => {
            const spotlight = [
                "Python",
                "Java",
                "TypeScript",
                "Go",
                "C++",
                "C#"
            ].includes(lang);

            return {
                value: lang,
                spotlight,
            };
        });
    }, []);

    const data = useMemo(() => {
        return {
            repos: repoSuggestions ?? [],
            languages: languageSuggestions,
            files: fileSuggestions ?? [],
        }
    }, [repoSuggestions, fileSuggestions, languageSuggestions]);

    return data;
}