'use client';

import { Repository } from "@/lib/types";
import { isDefined } from "@/lib/utils";
import { CommitIcon, FileIcon, MixerVerticalIcon } from "@radix-ui/react-icons";
import { IconProps } from "@radix-ui/react-icons/dist/types";
import clsx from "clsx";
import escapeStringRegexp from "escape-string-regexp";
import Fuse from "fuse.js";
import { Dispatch, SetStateAction, useEffect, useMemo } from "react";

type Icon = React.ForwardRefExoticComponent<IconProps & React.RefAttributes<SVGSVGElement>>;

type Suggestion = {
    value: string;
    description?: string;
}

// @note : Order here is important
const searchPrefixes: Suggestion[] = [
    {
        value: "repo:",
        description: "Include only results from the given repository."
    },
    {
        value: "lang:",
        description: "Include only results from the given language."
    },
    {
        value: "file:",
        description: "Include only results from filepaths matching the given search pattern."
    },
    {
        value: "rev:",
        description: "Search a given branch or tag instead of the default branch."
    },
    {
        value: "sym:",
        description: "Include only symbols matching the given search pattern."
    },
    {
        value: "archived:",
        description: "Include results from archived repositories."
    },
    {
        value: "case:",
        description: "Control case-sensitivity of search patterns."
    },
    {
        value: "fork:",
        description: "Include only results from forked repositories."
    },
    {
        value: "public:",
        description: "Filter on repository visibility."
    },
    {
        value: "content:",
        description: "Include only results from files if their content matches the given search pattern."
    },
    {
        value: "-lang:",
        description: "Exclude results from the given language."
    },
    {
        value: "-repo:",
        description: "Exclude results from the given repository."
    },
    {
        value: "-file:",
        description: "Exclude results from file paths matching the given search pattern."
    },
    {
        value: "-rev:",
        description: "Exclude results from the given branch or tag."
    },
    {
        value: "-sym:",
        description: "Exclude results from symbols matching the given search pattern."
    },
    {
        value: "-content:",
        description: "Exclude results from files if their content matches the given search pattern."
    }
];

type SuggestionMode =
    "filter" |
    "archived" |
    "file" |
    "language" |
    "case" |
    "fork" |
    "public" |
    "revision" |
    "symbol" |
    "content" |
    "repo";

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

        if (end.startsWith("lang:") || end.startsWith("-lang:")) {
            const index = end.indexOf(":");
            return {
                suggestionQuery: end.substring(index + 1),
                suggestionMode: "language",
            }
        }

        if (end.startsWith("file:") || end.startsWith("-file:")) {
            const index = end.indexOf(":");
            return {
                suggestionQuery: end.substring(index + 1),
                suggestionMode: "file",
            }
        }

        if (end.startsWith("content:") || end.startsWith("-content:")) {
            const index = end.indexOf(":");
            return {
                suggestionQuery: end.substring(index + 1),
                suggestionMode: "content",
            }
        }

        if (
            end.startsWith("rev:") ||
            end.startsWith("-rev:") ||
            end.startsWith("revision:") ||
            end.startsWith("-revision:")
        ) {
            const index = end.indexOf(":");
            return {
                suggestionQuery: end.substring(index + 1),
                suggestionMode: "revision",
            }
        }

        if (end.startsWith("sym:") || end.startsWith("-sym:")) {
            const index = end.indexOf(":");
            return {
                suggestionQuery: end.substring(index + 1),
                suggestionMode: "symbol",
            }
        }

        if (end.startsWith("archived:")) {
            const index = end.indexOf(":");
            return {
                suggestionQuery: end.substring(index + 1),
                suggestionMode: "archived",
            }
        }

        if (end.startsWith("case:")) {
            const index = end.indexOf(":");
            return {
                suggestionQuery: end.substring(index + 1),
                suggestionMode: "case",
            }
        }

        if (end.startsWith("fork:")) {
            const index = end.indexOf(":");
            return {
                suggestionQuery: end.substring(index + 1),
                suggestionMode: "fork",
            }
        }

        if (end.startsWith("public:")) {
            const index = end.indexOf(":");
            return {
                suggestionQuery: end.substring(index + 1),
                suggestionMode: "public",
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

        const createOnSuggestionClickedHandler = (params: { regexEscaped?: boolean, trailingSpace?: boolean } = {}) => {
            const {
                regexEscaped = false,
                trailingSpace = true
            } = params;

            return (value: string) => {
                onCompletion((prevQuery) => {
                    let newQuery = prevQuery;
                    if (suggestionQuery.length > 0) {
                        newQuery = newQuery.slice(0, -suggestionQuery.length);
                    }

                    if (regexEscaped) {
                        newQuery = newQuery + `^${escapeStringRegexp(value)}$`;
                    } else {
                        newQuery = newQuery + value;
                    }

                    if (trailingSpace) {
                        newQuery = newQuery + " ";
                    }

                    return newQuery;
                });
            }
        }

        const {
            threshold = 0.5,
            limit = 10,
            list,
            isHighlightEnabled = false,
            onSuggestionClicked,
            Icon,
        } = ((): {
            threshold?: number,
            limit?: number,
            list: Suggestion[],
            isHighlightEnabled?: boolean,
            onSuggestionClicked: (value: string) => void,
            Icon?: Icon
        } => {
            switch (suggestionMode) {
                case "revision":
                    return {
                        list: [
                            { value: "HEAD", description: "(default)" }
                        ],
                        onSuggestionClicked: createOnSuggestionClickedHandler(),
                    }
                case "public":
                    return {
                        list: [
                            { value: "yes", description: "Only include results from public repositories." },
                            { value: "no", description: "Only include results from private repositories." },
                        ],
                        onSuggestionClicked: createOnSuggestionClickedHandler(),
                    }
                case "fork":
                    return {
                        list: [
                            { value: "yes", description: "Only include results from forked repositories." },
                            { value: "no", description: "Only include results from non-forked repositories." },
                        ],
                        onSuggestionClicked: createOnSuggestionClickedHandler(),
                    }
                case "case":
                    return {
                        list: [
                            { value: "auto", description: "Search patterns are case-insensitive if all characters are lowercase, and case sensitive otherwise (default)." },
                            { value: "yes", description: "Case sensitive search." },
                            { value: "no", description: "Case insensitive search." },
                        ],
                        onSuggestionClicked: createOnSuggestionClickedHandler(),
                    }
                case "archived":
                    return {
                        list: [
                            { value: "yes", description: "Only include results in archived repositories." },
                            { value: "no", description: "Only include results in non-archived repositories." },
                        ],
                        onSuggestionClicked: createOnSuggestionClickedHandler(),
                    }
                case "repo":
                    return {
                        list: repos,
                        Icon: CommitIcon,
                        onSuggestionClicked: createOnSuggestionClickedHandler({ regexEscaped: true}),
                    }
                case "language":
                    return {
                        // @todo: get list of languages
                        list: [],
                        onSuggestionClicked: createOnSuggestionClickedHandler(),
                    }
                case "file":
                    return {
                        list: [], // todo
                        Icon: FileIcon,
                        onSuggestionClicked: createOnSuggestionClickedHandler({ regexEscaped: true }),
                    }
                case "filter":
                    return {
                        threshold: 0.1,
                        limit: 5,
                        list: searchPrefixes,
                        isHighlightEnabled: true,
                        Icon: MixerVerticalIcon,
                        onSuggestionClicked: createOnSuggestionClickedHandler({ trailingSpace: false }),
                    }
                default:
                    return {
                        list: [],
                        onSuggestionClicked: createOnSuggestionClickedHandler(),
                    }
            }
        })();

        const fuse = new Fuse(list, {
            threshold,
            keys: ['value'],
        });

        const results = (() => {
            if (suggestionQuery.length === 0) {
                return list.slice(0, limit);
            }

            return fuse.search(suggestionQuery, {
                limit,
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
                    {Icon && (
                        <Icon className="w-3 h-3 mr-2" />
                    )}
                    <div className="flex flex-row items-center">
                        <span
                            className={clsx('mr-2 flex-none', {
                                "text-highlight": isHighlightEnabled
                            })}
                        >
                            {result.value}
                        </span>
                        {result.description && (
                            <span className="text-muted-foreground font-light">
                                {result.description}
                            </span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}