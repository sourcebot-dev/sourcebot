'use client';

import { useMemo } from "react";
import { Suggestion } from "./searchSuggestionsBox";
import { SearchPrefix } from "./constants";
import { useHasEntitlement } from "@/features/entitlements/useHasEntitlement";

const negate = (prefix: SearchPrefix) => {
    return `-${prefix}`;
}

export const useRefineModeSuggestions = () => {
    const isSearchContextsEnabled = useHasEntitlement('search-contexts');

    const suggestions = useMemo((): Suggestion[] => {
        return [
            ...(isSearchContextsEnabled ? [
                {
                    value: SearchPrefix.context,
                    description: "Include only results from the given search context.",
                    spotlight: true,
                },
                {
                    value: negate(SearchPrefix.context),
                    description: "Exclude results from the given search context."
                },
            ] : []),
            {
                value: SearchPrefix.visibility,
                description: "Filter on repository visibility."
            },
            {
                value: SearchPrefix.repo,
                description: "Include only results from the given repository.",
                spotlight: true,
            },
            {
                value: SearchPrefix.author,
                description: "Include only results from the given author.",
                spotlight: true,
            },
            {
                value: negate(SearchPrefix.repo),
                description: "Exclude results from the given repository."
            },
            {
                value: SearchPrefix.lang,
                description: "Include only results from the given language.",
                spotlight: true,
            },
            {
                value: negate(SearchPrefix.lang),
                description: "Exclude results from the given language."
            },
            {
                value: SearchPrefix.file,
                description: "Include only results from filepaths matching the given search pattern.",
                spotlight: true,
            },
            {
                value: negate(SearchPrefix.file),
                description: "Exclude results from file paths matching the given search pattern."
            },
            {
                value: SearchPrefix.rev,
                description: "Search a given branch or tag instead of the default branch.",
                spotlight: true,
            },
            {
                value: negate(SearchPrefix.rev),
                description: "Exclude results from the given branch or tag."
            },
            {
                value: SearchPrefix.sym,
                description: "Include only symbols matching the given search pattern.",
                spotlight: true,
            },
            {
                value: negate(SearchPrefix.sym),
                description: "Exclude results from symbols matching the given search pattern."
            },
            {
                value: SearchPrefix.content,
                description: "Include only results from files if their content matches the given search pattern."
            },
            {
                value: negate(SearchPrefix.content),
                description: "Exclude results from files if their content matches the given search pattern."
            },
            {
                value: SearchPrefix.archived,
                description: "Include results from archived repositories.",
            },
            {
                value: SearchPrefix.fork,
                description: "Include only results from forked repositories."
            },
        ];
    }, [isSearchContextsEnabled]);

    return suggestions;
}