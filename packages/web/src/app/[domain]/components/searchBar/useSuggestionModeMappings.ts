'use client';

import { useMemo } from "react";
import { SearchPrefix } from "./constants";
import { SuggestionMode } from "./searchSuggestionsBox";
import { useHasEntitlement } from "@/features/entitlements/useHasEntitlement";

const negate = (prefix: SearchPrefix) => {
    return `-${prefix}`;
}

type SuggestionModeMapping = {
    suggestionMode: SuggestionMode,
    prefixes: string[],
}

/**
 * Maps search prefixes to a suggestion mode. When a query starts
 * with a prefix, the corresponding suggestion mode is enabled.
 * @see [searchSuggestionsBox.tsx](./searchSuggestionsBox.tsx)
 */
export const useSuggestionModeMappings = () => {
    const isSearchContextsEnabled = useHasEntitlement('search-contexts');

    const mappings = useMemo((): SuggestionModeMapping[] => {
        return [
            {
                suggestionMode: "repo",
                prefixes: [
                    SearchPrefix.repo, negate(SearchPrefix.repo),
                    SearchPrefix.r, negate(SearchPrefix.r),
                ]
            },
            {
                suggestionMode: "language",
                prefixes: [
                    SearchPrefix.lang, negate(SearchPrefix.lang),
                ]
            },
            {
                suggestionMode: "file",
                prefixes: [
                    SearchPrefix.file, negate(SearchPrefix.file),
                ]
            },
            {
                suggestionMode: "content",
                prefixes: [
                    SearchPrefix.content, negate(SearchPrefix.content),
                ]
            },
            {
                suggestionMode: "revision",
                prefixes: [
                    SearchPrefix.rev, negate(SearchPrefix.rev),
                    SearchPrefix.revision, negate(SearchPrefix.revision),
                    SearchPrefix.branch, negate(SearchPrefix.branch),
                    SearchPrefix.b, negate(SearchPrefix.b),
                ]
            },
            {
                suggestionMode: "symbol",
                prefixes: [
                    SearchPrefix.sym, negate(SearchPrefix.sym),
                ]
            },
            {
                suggestionMode: "archived",
                prefixes: [
                    SearchPrefix.archived
                ]
            },
            {
                suggestionMode: "case",
                prefixes: [
                    SearchPrefix.case
                ]
            },
            {
                suggestionMode: "fork",
                prefixes: [
                    SearchPrefix.fork
                ]
            },
            {
                suggestionMode: "public",
                prefixes: [
                    SearchPrefix.public
                ]
            },
            ...(isSearchContextsEnabled ? [
                {
                    suggestionMode: "context",
                    prefixes: [
                        SearchPrefix.context,
                        negate(SearchPrefix.context),
                    ]
                } satisfies SuggestionModeMapping,
            ] : []),
        ]
    }, [isSearchContextsEnabled]);

    return mappings;
}