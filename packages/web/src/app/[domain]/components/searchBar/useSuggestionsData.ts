'use client';

import { useQuery } from "@tanstack/react-query";
import { Suggestion, SuggestionMode } from "./searchSuggestionsBox";
import { getRepos, search } from "@/app/api/(client)/client";
import { useMemo } from "react";
import { Symbol } from "@/lib/types";
import { languageMetadataMap } from "@/lib/languageMetadata";
import {
    VscSymbolClass,
    VscSymbolConstant,
    VscSymbolEnum,
    VscSymbolField,
    VscSymbolInterface,
    VscSymbolMethod,
    VscSymbolProperty,
    VscSymbolStructure,
    VscSymbolVariable
} from "react-icons/vsc";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { getDisplayTime } from "@/lib/utils";
import { useDomain } from "@/hooks/useDomain";


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
    const domain = useDomain();
    const { data: repoSuggestions, isLoading: _isLoadingRepos } = useQuery({
        queryKey: ["repoSuggestions"],
        queryFn: () => getRepos(domain),
        select: (data): Suggestion[] => {
            return data.List.Repos
                .map(r => r.Repository)
                .map(r => ({
                    value: r.Name
                }));
        },
        enabled: suggestionMode === "repo",
    });
    const isLoadingRepos = useMemo(() => suggestionMode === "repo" && _isLoadingRepos, [_isLoadingRepos, suggestionMode]);

    const { data: fileSuggestions, isLoading: _isLoadingFiles } = useQuery({
        queryKey: ["fileSuggestions", suggestionQuery],
        queryFn: () => search({
            query: `file:${suggestionQuery}`,
            maxMatchDisplayCount: 15,
        }, domain),
        select: (data): Suggestion[] => {
            return data.Result.Files?.map((file) => ({
                value: file.FileName
            })) ?? [];
        },
        enabled: suggestionMode === "file"
    });
    const isLoadingFiles = useMemo(() => suggestionMode === "file" && _isLoadingFiles, [_isLoadingFiles, suggestionMode]);

    const { data: symbolSuggestions, isLoading: _isLoadingSymbols } = useQuery({
        queryKey: ["symbolSuggestions", suggestionQuery],
        queryFn: () => search({
            query: `sym:${suggestionQuery.length > 0 ? suggestionQuery : ".*"}`,
            maxMatchDisplayCount: 15,
        }, domain),
        select: (data): Suggestion[] => {
            const symbols = data.Result.Files?.flatMap((file) => file.ChunkMatches).flatMap((chunk) => chunk.SymbolInfo ?? []);
            if (!symbols) {
                return [];
            }

            // De-duplicate on symbol name & kind.
            const symbolMap = new Map<string, Symbol>(symbols.map((symbol: Symbol) => [`${symbol.Kind}.${symbol.Sym}`, symbol]));
            const suggestions = Array.from(symbolMap.values()).map((symbol) => ({
                value: symbol.Sym,
                Icon: getSymbolIcon(symbol),
            } satisfies Suggestion));

            return suggestions;
        },
        enabled: suggestionMode === "symbol",
    });
    const isLoadingSymbols = useMemo(() => suggestionMode === "symbol" && _isLoadingSymbols, [suggestionMode, _isLoadingSymbols]);

    const languageSuggestions = useMemo((): Suggestion[] => {
        return Object.keys(languageMetadataMap).map((lang) => {
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

    const { searchHistory } = useSearchHistory();
    const searchHistorySuggestions = useMemo(() => {
        return searchHistory.map(search => ({
            value: search.query,
            description: getDisplayTime(new Date(search.date)),
        } satisfies Suggestion));
    }, [searchHistory]);

    const isLoadingSuggestions = useMemo(() => {
        return isLoadingSymbols || isLoadingFiles || isLoadingRepos;
    }, [isLoadingFiles, isLoadingRepos, isLoadingSymbols]);

    return {
        repoSuggestions: repoSuggestions ?? [],
        fileSuggestions: fileSuggestions ?? [],
        symbolSuggestions: symbolSuggestions ?? [],
        languageSuggestions,
        searchHistorySuggestions,
        isLoadingSuggestions,
    }
}

const getSymbolIcon = (symbol: Symbol) => {
    switch (symbol.Kind) {
        case "methodSpec":
        case "method":
        case "function":
        case "func":
            return VscSymbolMethod;
        case "variable":
            return VscSymbolVariable;
        case "class":
            return VscSymbolClass;
        case "const":
        case "macro":
        case "constant":
            return VscSymbolConstant;
        case "property":
            return VscSymbolProperty;
        case "struct":
            return VscSymbolStructure;
        case "field":
        case "member":
            return VscSymbolField;
        case "interface":
            return VscSymbolInterface;
        case "enum":
        case "enumerator":
            return VscSymbolEnum;
    }
}
