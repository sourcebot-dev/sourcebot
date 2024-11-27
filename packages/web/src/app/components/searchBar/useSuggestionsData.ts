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

    const { data: symbolSuggestions } = useQuery({
        queryKey: ["symbolSuggestions", suggestionQuery],
        queryFn: () => search({
            query: `sym:${suggestionQuery.length > 0 ? suggestionQuery : ".*"}`,
            maxMatchDisplayCount: 15,
        }),
        select: (data): Suggestion[] => {
            const symbols = data.Result.Files?.flatMap((file) => file.ChunkMatches).flatMap((chunk) => chunk.SymbolInfo ?? []);
            if (!symbols) {
                return [];
            }

            const symbolSet = new Set(symbols.map((symbol) => symbol.Sym));
            return Array.from(symbolSet).map((sym) => ({
                value: sym,
            }));
        },
        enabled: suggestionMode === "symbol",
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
            symbols: symbolSuggestions ?? [],
        }
    }, [repoSuggestions, fileSuggestions, languageSuggestions, symbolSuggestions]);

    return data;
}