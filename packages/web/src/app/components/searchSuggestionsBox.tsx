'use client';

import { Repository } from "@/lib/types";
import { isDefined } from "@/lib/utils";
import { CommitIcon, FileIcon, MixerVerticalIcon } from "@radix-ui/react-icons";
import { IconProps } from "@radix-ui/react-icons/dist/types";
import assert from "assert";
import clsx from "clsx";
import escapeStringRegexp from "escape-string-regexp";
import Fuse from "fuse.js";
import { forwardRef, Ref, useEffect, useMemo, useState } from "react";

type Icon = React.ForwardRefExoticComponent<IconProps & React.RefAttributes<SVGSVGElement>>;

type Suggestion = {
    value: string;
    description?: string;
}

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


interface SearchSuggestionsBoxProps {
    query: string;
    onCompletion: (value: ((prevQuery: string) => { newQuery: string, newCursorPosition: number } )) => void,
    isVisible: boolean;
    onVisibilityChanged: (isVisible: boolean) => void;
    cursorPosition: number;
    isFocused: boolean;
    onFocus: () => void;
    onBlur: () => void;
    onReturnFocus: () => void;

    // data
    data: {
        repos: Repository[];
    }
}

const SearchSuggestionsBox = forwardRef(({
    query,
    onCompletion,
    isVisible,
    onVisibilityChanged,
    data,
    cursorPosition,
    isFocused,
    onFocus,
    onBlur,
    onReturnFocus,
}: SearchSuggestionsBoxProps, ref: Ref<HTMLDivElement>) => {

    const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(0);

    // When we start typing, set the suggestion box to visible
    useEffect(() => {
        if (query.length > 0) {
            onVisibilityChanged(true);
        }
    }, [query, onVisibilityChanged]);

    // Transform data to suggestions
    const { repos } = useMemo(() => {
        const repos: Suggestion[] = data.repos.map((repo) => ({
            value: repo.Name,
        }));
        return {
            repos,
        };
    }, [data.repos]);

    const { suggestionQuery, suggestionMode } = useMemo<{ suggestionQuery?: string, suggestionMode?: SuggestionMode }>(() => {
        const { queryParts, cursorIndex } = splitQuery(query, " ", cursorPosition);
        if (queryParts.length === 0) {
            return {};
        }
        const part = queryParts[cursorIndex];

        if (part.startsWith("repo:") || part.startsWith("-repo:")) {
            const index = part.indexOf(":");
            return {
                suggestionQuery: part.substring(index + 1),
                suggestionMode: "repo",
            }
        }

        if (part.startsWith("lang:") || part.startsWith("-lang:")) {
            const index = part.indexOf(":");
            return {
                suggestionQuery: part.substring(index + 1),
                suggestionMode: "language",
            }
        }

        if (part.startsWith("file:") || part.startsWith("-file:")) {
            const index = part.indexOf(":");
            return {
                suggestionQuery: part.substring(index + 1),
                suggestionMode: "file",
            }
        }

        if (part.startsWith("content:") || part.startsWith("-content:")) {
            const index = part.indexOf(":");
            return {
                suggestionQuery: part.substring(index + 1),
                suggestionMode: "content",
            }
        }

        if (
            part.startsWith("rev:") ||
            part.startsWith("-rev:") ||
            part.startsWith("revision:") ||
            part.startsWith("-revision:")
        ) {
            const index = part.indexOf(":");
            return {
                suggestionQuery: part.substring(index + 1),
                suggestionMode: "revision",
            }
        }

        if (part.startsWith("sym:") || part.startsWith("-sym:")) {
            const index = part.indexOf(":");
            return {
                suggestionQuery: part.substring(index + 1),
                suggestionMode: "symbol",
            }
        }

        if (part.startsWith("archived:")) {
            const index = part.indexOf(":");
            return {
                suggestionQuery: part.substring(index + 1),
                suggestionMode: "archived",
            }
        }

        if (part.startsWith("case:")) {
            const index = part.indexOf(":");
            return {
                suggestionQuery: part.substring(index + 1),
                suggestionMode: "case",
            }
        }

        if (part.startsWith("fork:")) {
            const index = part.indexOf(":");
            return {
                suggestionQuery: part.substring(index + 1),
                suggestionMode: "fork",
            }
        }

        if (part.startsWith("public:")) {
            const index = part.indexOf(":");
            return {
                suggestionQuery: part.substring(index + 1),
                suggestionMode: "public",
            }
        }

        // Default to filter mode
        return {
            suggestionQuery: part,
            suggestionMode: "filter",
        }
    }, [cursorPosition, query]);

    // When the suggestion mode changes, reset the highlight index
    useEffect(() => {
        setHighlightedSuggestionIndex(0);
    }, [suggestionMode]);

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
                    const { queryParts, cursorIndex } = splitQuery(prevQuery, " ", cursorPosition);

                    const start = queryParts.slice(0, cursorIndex).join(" ");
                    const end = queryParts.slice(cursorIndex + 1).join(" ");

                    let part = queryParts[cursorIndex];

                    // Remove whatever query we have in the suggestion so far (if any).
                    // For example, if our part is "repo:gith", then we want to remove "gith"
                    // from the part before we complete the suggestion.
                    if (suggestionQuery.length > 0) {
                        part = part.slice(0, -suggestionQuery.length);
                    }

                    if (regexEscaped) {
                        part = part + `^${escapeStringRegexp(value)}$`;
                    } else {
                        part = part + value;
                    }

                    // Add a trailing space if we are at the end of the query
                    if (trailingSpace && cursorIndex === queryParts.length - 1) {
                        part += " ";
                    }

                    let newQuery = [
                        ...(start.length > 0 ? [start] : []),
                        part,
                    ].join(" ");
                    const newCursorPosition = newQuery.length;

                    newQuery = [
                        newQuery,
                        ...(end.length > 0 ? [end] : []),
                    ].join(" ");

                    return {
                        newQuery,
                        newCursorPosition,
                    }
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
                        onSuggestionClicked: createOnSuggestionClickedHandler({ regexEscaped: true }),
                    }
                case "language":
                    return {
                        // @todo: get list of languages
                        list: [],
                        onSuggestionClicked: createOnSuggestionClickedHandler(),
                    }
                case "file":
                    return {
                        // @todo
                        list: [],
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
            isCaseSensitive: true,
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

    }, [suggestionQuery, suggestionMode, onCompletion, cursorPosition, repos]);

    const suggestionModeText = useMemo(() => {
        if (!suggestionMode) {
            return "";
        }
        switch (suggestionMode) {
            case "repo":
                return "Repositories";
            case "filter":
                return "Filter by"
            default:
                return "";
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
            ref={ref}
            className="w-full absolute z-10 top-12 border rounded-md bg-background drop-shadow-2xl p-2"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.stopPropagation();
                    const value = suggestions[highlightedSuggestionIndex].value;
                    onSuggestionClicked(value);
                }

                if (e.key === 'ArrowUp') {
                    e.stopPropagation();
                    setHighlightedSuggestionIndex((curIndex) => {
                        return curIndex <= 0 ? suggestions.length - 1 : curIndex - 1;
                    });
                }

                if (e.key === 'ArrowDown') {
                    e.stopPropagation();
                    setHighlightedSuggestionIndex((curIndex) => {
                        return curIndex >= suggestions.length - 1 ? 0 : curIndex + 1;
                    });
                }

                if (e.key === 'Escape') {
                    e.stopPropagation();
                    onReturnFocus();
                }
            }}
            onFocus={onFocus}
            onBlur={onBlur}
        >
            <p className="text-muted-foreground text-sm mb-1">
                {suggestionModeText}
            </p>
            {suggestions.map((result, index) => (
                <div
                    key={index}
                    className={clsx("flex flex-row items-center font-mono text-sm hover:bg-muted rounded-md px-1 py-0.5 cursor-pointer", {
                        "bg-muted": isFocused && index === highlightedSuggestionIndex,
                    })}
                    tabIndex={-1}
                    onClick={() => {
                        onSuggestionClicked(result.value)
                    }}
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
            {isFocused && (
                <div className="flex flex-row items-center justify-end mt-1">
                    <span className="text-muted-foreground text-xs">
                        Press <kbd className="font-mono text-xs font-bold">Enter</kbd> to select
                    </span>
                </div>
            )}
        </div>
    )
});

SearchSuggestionsBox.displayName = "SearchSuggestionsBox";
export { SearchSuggestionsBox };

const splitQuery = (query: string, seperator: string, cursorPos: number) => {
    const queryParts = [];
    let cursorIndex = 0;
    let accumulator = "";

    for (let i = 0; i < query.length; i++) {
        if (i === cursorPos) {
            cursorIndex = queryParts.length;
        }

        if (query[i] === seperator) {
            queryParts.push(accumulator);
            accumulator = "";
            continue;
        }

        accumulator += query[i];
    }
    queryParts.push(accumulator);
    
    // Edge case: if the cursor is at the end of the query, set the cursor index to the last query part
    if (cursorPos === query.length) {
        cursorIndex = queryParts.length - 1;
    }

    // @note: since we're guaranteed to have at least one query part, we can safely assume that the cursor position
    // will be within bounds.
    assert(cursorIndex >= 0 && cursorIndex < queryParts.length, "Cursor position is out of bounds");

    return {
        queryParts,
        cursorIndex
    }
}