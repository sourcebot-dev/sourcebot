'use client';

import { isDefined } from "@/lib/utils";
import assert from "assert";
import clsx from "clsx";
import escapeStringRegexp from "escape-string-regexp";
import Fuse from "fuse.js";
import { forwardRef, Ref, useEffect, useMemo, useState } from "react";
import {
    archivedModeSuggestions,
    caseModeSuggestions,
    forkModeSuggestions,
    publicModeSuggestions,
    refineModeSuggestions,
    suggestionModeMappings
} from "./constants";
import { IconType } from "react-icons/lib";
import { VscFile, VscFilter, VscRepo, VscSymbolMisc } from "react-icons/vsc";

export type Suggestion = {
    value: string;
    description?: string;
    spotlight?: boolean;
    Icon?: IconType;
}

export type SuggestionMode =
    "refine" |
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
    onCompletion: (newQuery: string, newCursorPosition: number) => void,
    isEnabled: boolean;
    cursorPosition: number;
    isFocused: boolean;
    onFocus: () => void;
    onBlur: () => void;
    onReturnFocus: () => void;
    onSuggestionModeChanged: (suggestionMode: SuggestionMode) => void;
    onSuggestionQueryChanged: (suggestionQuery: string) => void;

    isLoadingSuggestions: boolean;
    repoSuggestions: Suggestion[];
    fileSuggestions: Suggestion[];
    symbolSuggestions: Suggestion[];
    languageSuggestions: Suggestion[];
}

const SearchSuggestionsBox = forwardRef(({
    query,
    onCompletion,
    isEnabled,
    cursorPosition,
    isFocused,
    onFocus,
    onBlur,
    onReturnFocus,
    onSuggestionModeChanged,
    onSuggestionQueryChanged,
    isLoadingSuggestions,
    repoSuggestions,
    fileSuggestions,
    symbolSuggestions,
    languageSuggestions,
}: SearchSuggestionsBoxProps, ref: Ref<HTMLDivElement>) => {

    const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(0);

    const { suggestionQuery, suggestionMode } = useMemo<{ suggestionQuery?: string, suggestionMode?: SuggestionMode }>(() => {
        // Only re-calculate the suggestion mode and query if the box is enabled.
        // This is to avoid transitioning the suggestion mode and causing a fetch
        // when it is not needed.
        // @see: useSuggestionsData.ts
        if (!isEnabled) {
            return {};
        }

        const { queryParts, cursorIndex } = splitQuery(query, cursorPosition);
        if (queryParts.length === 0) {
            return {};
        }
        const part = queryParts[cursorIndex];

        // Check if the query part starts with one of the
        // prefixes. If it does, then we are in the corresponding
        // suggestion mode for that prefix.
        const suggestionMode = (() => {
            for (const mapping of suggestionModeMappings) {
                for (const prefix of mapping.prefixes) {
                    if (part.startsWith(prefix)) {
                        return mapping.suggestionMode;
                    }
                }
            }
        })();

        if (suggestionMode) {
            const index = part.indexOf(":");
            return {
                suggestionQuery: part.substring(index + 1),
                suggestionMode,
            }
        }

        // Default to the refine suggestion mode
        // if there was no match.
        return {
            suggestionQuery: part,
            suggestionMode: "refine",
        }
    }, [cursorPosition, isEnabled, query]);

    const { suggestions, isHighlightEnabled, DefaultIcon, onSuggestionClicked } = useMemo(() => {
        if (!isEnabled || !isDefined(suggestionQuery) || !isDefined(suggestionMode)) {
            return {};
        }

        const createOnSuggestionClickedHandler = (params: { regexEscaped?: boolean, trailingSpace?: boolean } = {}) => {
            const {
                regexEscaped = false,
                trailingSpace = true
            } = params;

            const onSuggestionClicked = (suggestion: string) => {
                const { newQuery, newCursorPosition } = completeSuggestion({
                    query,
                    cursorPosition,
                    regexEscaped,
                    trailingSpace,
                    suggestion,
                    suggestionQuery,
                });

                onCompletion(newQuery, newCursorPosition);
            }

            return onSuggestionClicked;
        }

        const {
            threshold = 0.5,
            limit = 10,
            list,
            isHighlightEnabled = false,
            isSpotlightEnabled = false,
            isClientSideSearchEnabled = true,
            onSuggestionClicked,
            DefaultIcon,
        } = ((): {
            threshold?: number,
            limit?: number,
            list: Suggestion[],
            isHighlightEnabled?: boolean,
            isSpotlightEnabled?: boolean,
            isClientSideSearchEnabled?: boolean,
            onSuggestionClicked: (value: string) => void,
            DefaultIcon?: IconType
        } => {
            switch (suggestionMode) {
                case "public":
                    return {
                        list: publicModeSuggestions,
                        onSuggestionClicked: createOnSuggestionClickedHandler(),
                    }
                case "fork":
                    return {
                        list: forkModeSuggestions,
                        onSuggestionClicked: createOnSuggestionClickedHandler(),
                    }
                case "case":
                    return {
                        list: caseModeSuggestions,
                        onSuggestionClicked: createOnSuggestionClickedHandler(),
                    }
                case "archived":
                    return {
                        list: archivedModeSuggestions,
                        onSuggestionClicked: createOnSuggestionClickedHandler(),
                    }
                case "repo":
                    return {
                        list: repoSuggestions,
                        DefaultIcon: VscRepo,
                        onSuggestionClicked: createOnSuggestionClickedHandler({ regexEscaped: true }),
                    }
                case "language": {
                    return {
                        list: languageSuggestions,
                        onSuggestionClicked: createOnSuggestionClickedHandler(),
                        isSpotlightEnabled: true,
                    }
                }
                case "refine":
                    return {
                        threshold: 0.1,
                        list: refineModeSuggestions,
                        isHighlightEnabled: true,
                        isSpotlightEnabled: true,
                        DefaultIcon: VscFilter,
                        onSuggestionClicked: createOnSuggestionClickedHandler({ trailingSpace: false }),
                    }
                case "file":
                    return {
                        list: fileSuggestions,
                        onSuggestionClicked: createOnSuggestionClickedHandler(),
                        isClientSideSearchEnabled: false,
                        DefaultIcon: VscFile,
                    }
                case "symbol":
                    return {
                        list: symbolSuggestions,
                        onSuggestionClicked: createOnSuggestionClickedHandler(),
                        isClientSideSearchEnabled: false,
                        DefaultIcon: VscSymbolMisc,
                    }
                case "revision":
                case "content":
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

        const suggestions = (() => {
            if (suggestionQuery.length === 0) {
                // If spotlight is enabled, get the suggestions that are
                // flagged to be surfaced.
                if (isSpotlightEnabled) {
                    const spotlightSuggestions = list.filter((suggestion) => suggestion.spotlight);
                    return spotlightSuggestions;

                    // Otherwise, just show the Nth first suggestions.
                } else {
                    return list.slice(0, limit);
                }
            }

            // Special case: don't show any suggestions if the query
            // is the keyword "or".
            if (suggestionQuery === "or") {
                return [];
            }

            if (!isClientSideSearchEnabled) {
                return list;
            }

            return fuse.search(suggestionQuery, {
                limit,
            }).map(result => result.item);
        })();

        return {
            suggestions,
            isHighlightEnabled,
            DefaultIcon,
            onSuggestionClicked,
        }

    }, [isEnabled, suggestionQuery, suggestionMode, query, cursorPosition, onCompletion, repoSuggestions, fileSuggestions, symbolSuggestions, languageSuggestions]);

    // When the list of suggestions change, reset the highlight index
    useEffect(() => {
        setHighlightedSuggestionIndex(0);
    }, [suggestions]);

    useEffect(() => {
        if (isDefined(suggestionMode)) {
            onSuggestionModeChanged(suggestionMode);
        }
    }, [onSuggestionModeChanged, suggestionMode]);

    useEffect(() => {
        if (isDefined(suggestionQuery)) {
            onSuggestionQueryChanged(suggestionQuery);
        }
    }, [onSuggestionQueryChanged, suggestionQuery]);

    const suggestionModeText = useMemo(() => {
        if (!suggestionMode) {
            return "";
        }
        switch (suggestionMode) {
            case "repo":
                return "Repositories";
            case "refine":
                return "Refine search";
            case "file":
                return "Files";
            case "symbol":
                return "Symbols";
            case "language":
                return "Languages";
            default:
                return "";
        }
    }, [suggestionMode]);

    if (
        !isEnabled ||
        !suggestions
    ) {
        return null;
    }

    if (suggestions.length === 0 && !isLoadingSuggestions) {
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
                    if (highlightedSuggestionIndex < 0 || highlightedSuggestionIndex >= suggestions.length) {
                        return;
                    }
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
            {isLoadingSuggestions ? (
                // Skeleton placeholder
                <div className="animate-pulse flex flex-col gap-2 px-1 py-0.5">
                    {
                        Array.from({ length: 10 }).map((_, index) => (
                            <div key={index} className="h-4 bg-muted rounded-md w-full"></div>
                        ))
                    }
                </div>
            ) : suggestions.map((result, index) => (
                // Suggestion list
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
                    {result.Icon ? (
                        <result.Icon className="w-3 h-3 mr-2 flex-none" />
                    ) : DefaultIcon ? (
                        <DefaultIcon className="w-3 h-3 mr-2 flex-none" />
                    ) : null}
                    <span
                        className={clsx('mr-2', {
                            "text-highlight": isHighlightEnabled,
                            "truncate": !result.description,
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

export const splitQuery = (query: string, cursorPos: number) => {
    const queryParts = [];
    const seperator = " ";
    let cursorIndex = 0;
    let accumulator = "";
    let isInQuoteCapture = false;

    for (let i = 0; i < query.length; i++) {
        if (i === cursorPos) {
            cursorIndex = queryParts.length;
        }

        if (query[i] === "\"") {
            isInQuoteCapture = !isInQuoteCapture;
        }

        if (!isInQuoteCapture && query[i] === seperator) {
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

export const completeSuggestion = (params: {
    query: string,
    suggestionQuery: string,
    cursorPosition: number,
    suggestion: string,
    trailingSpace: boolean,
    regexEscaped: boolean,
}) => {
    const {
        query,
        suggestionQuery,
        cursorPosition,
        suggestion,
        trailingSpace,
        regexEscaped,
    } = params;

    const { queryParts, cursorIndex } = splitQuery(query, cursorPosition);

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
        part = part + `^${escapeStringRegexp(suggestion)}$`;
    } else if (suggestion.includes(" ")) {
        part = part + `"${suggestion}"`;
    } else {
        part = part + suggestion;
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
}