'use client';

import { Repository } from "@/lib/types";
import { isDefined } from "@/lib/utils";
import { CommitIcon, MixerVerticalIcon } from "@radix-ui/react-icons";
import clsx from "clsx";
import escapeStringRegexp from "escape-string-regexp";
import Fuse from "fuse.js";
import { Dispatch, SetStateAction, useEffect, useMemo } from "react";


type Suggestion = {
    value: string;
    description?: string;
}

const searchPrefixes: Suggestion[] = [
    {
        value: "repo:",
        description: "Include only results from the given repository."
    },
    {
        value: "file:",
        description: "Include only results from the given file."
    },
    {
        value: "-repo:",
        description: "Exclude results from the given repository."
    },
    { value: "-file:" }
];

const repos: Suggestion[] = [
    { value: "github.com/git/git" },
    { value: "github.com/golang/go" },
    { value: "github.com/torvalds/linux" },
    { value: "github.com/microsoft/vscode" },
    { value: "github.com/microsoft/vscode-docs" },
    { value: "github.com/rust-lang/rust" },
]

type SuggestionMode = "filter" | "repo";

interface SearchSuggestionsBoxProps {
    query: string;
    onCompletion: (value: ((prevQuery: string) => string)) => void,
    isVisible: boolean;
    setIsVisible: Dispatch<SetStateAction<boolean>>;

    // data
    data: {
        repos: Repository[];
    }
}

export const SearchSuggestionsBox = ({
    query,
    onCompletion,
    isVisible,
    setIsVisible,
    data,
}: SearchSuggestionsBoxProps) => {

    // When we start typing, set the suggestion box to visible
    useEffect(() => {
        if (query.length > 0) {
            setIsVisible(true);
        }
    }, [query, setIsVisible]);

    // Transform data to suggestions
    const { repos } = useMemo(() => {
        const repos: Suggestion[] = data.repos.map((repo) => ({
            value: repo.Name,
        }));
        return {
            repos,
        }
    }, [data.repos]);

    const { suggestionQuery, suggestionMode } = useMemo<{ suggestionQuery?: string, suggestionMode?: SuggestionMode }>(() => {
        const queryParts = query.split(" ");
        if (queryParts.length === 0) {
            return {};
        }
        const end = queryParts[queryParts.length - 1];

        if (end.startsWith("repo:") || end.startsWith("-repo:")) {
            const index = end.indexOf(":");
            return {
                suggestionQuery: end.substring(index + 1),
                suggestionMode: "repo",
            }
        }

        // Default to filter mode
        return {
            suggestionQuery: end,
            suggestionMode: "filter",
        }
    }, [query]);

    const { suggestions, isHighlightEnabled, Icon, onSuggestionClicked } = useMemo(() => {
        if (!isDefined(suggestionQuery) || !isDefined(suggestionMode)) {
            return {};
        }

        const { threshold, list, isHighlightEnabled, onSuggestionClicked, Icon } = (() => {
            switch (suggestionMode) {
                case "repo":
                    return {
                        threshold: 0.5,
                        list: repos,
                        isHighlightEnabled: false,
                        Icon: CommitIcon,
                        onSuggestionClicked: (value: string) => {
                            onCompletion((prevQuery) => {
                                let newQuery = prevQuery;
                                if (suggestionQuery.length > 0) {
                                    newQuery = newQuery.slice(0, -suggestionQuery.length);
                                }
                                newQuery = newQuery + `^${escapeStringRegexp(value)}$` + " ";
                                return newQuery;
                            });
                        }
                    }
                case "filter":
                    return {
                        threshold: 0.1,
                        list: searchPrefixes,
                        isHighlightEnabled: true,
                        Icon: MixerVerticalIcon,
                        onSuggestionClicked: (value: string) => {
                            onCompletion((prevQuery) => {
                                let newQuery = prevQuery;
                                if (suggestionQuery.length > 0) {
                                    newQuery = newQuery.slice(0, -suggestionQuery.length);
                                }
                                newQuery = newQuery + value;
                                return newQuery;
                            });
                        }
                    }
            }
        })();

        const fuse = new Fuse(list, {
            threshold,
            keys: ['value'],
        });

        const results = (() => {
            if (suggestionQuery.length === 0) {
                return list.slice(0, 10);
            }

            return fuse.search(suggestionQuery, {
                limit: 10,
            }).map(result => result.item)
        })();

        return {
            suggestions: results,
            isHighlightEnabled,
            Icon,
            onSuggestionClicked,
        }

    }, [suggestionQuery, suggestionMode, repos, onCompletion]);

    const suggestionModeText = useMemo(() => {
        if (!suggestionMode) {
            return "";
        }
        switch (suggestionMode) {
            case "repo":
                return "Repositories";
            case "filter":
                return "Filter by"
        }
    }, [suggestionMode]);

    if (
        !isVisible ||
        !suggestions ||
        suggestions.length === 0
    ) {
        return null;
    }

    return (
        <div
            className="w-full absolute z-10 top-12 border rounded-md bg-background drop-shadow-2xl p-2"
        >
            <p className="text-muted-foreground text-sm mb-1">
                {suggestionModeText}
            </p>
            {suggestions.map((result, index) => (
                <div
                    key={index}
                    className="flex flex-row items-center font-mono text-sm hover:bg-muted rounded-md px-1 py-0.5 cursor-pointer"
                    onClick={() => onSuggestionClicked(result.value)}
                >
                    <Icon className="w-3 h-3 mr-2" />
                    <span
                        className={clsx('mr-1', {
                            "text-highlight": isHighlightEnabled
                        })}
                    >
                        {result.value}
                    </span>
                    {result.description && (
                        <span>
                            {result.description}
                        </span>
                    )}
                </div>
            ))}
        </div>
    )
}