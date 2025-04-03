'use client';

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
} from "./constants";
import { IconType } from "react-icons/lib";
import { VscFile, VscFilter, VscRepo, VscSymbolMisc } from "react-icons/vsc";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { KeyboardShortcutHint } from "../keyboardShortcutHint";
import { useSyntaxGuide } from "@/app/[domain]/components/syntaxGuideProvider";

export type Suggestion = {
    value: string;
    description?: string;
    spotlight?: boolean;
    Icon?: IconType;
}

export type SuggestionMode =
    "none" |
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
    "repo" |
    "searchHistory" |
    "context";

interface SearchSuggestionsBoxProps {
    query: string;
    suggestionQuery: string;
    suggestionMode: SuggestionMode;
    onCompletion: (newQuery: string, newCursorPosition: number, autoSubmit?: boolean) => void,
    isEnabled: boolean;
    cursorPosition: number;
    isFocused: boolean;
    onFocus: () => void;
    onBlur: () => void;
    onReturnFocus: () => void;

    isLoadingSuggestions: boolean;
    repoSuggestions: Suggestion[];
    fileSuggestions: Suggestion[];
    symbolSuggestions: Suggestion[];
    languageSuggestions: Suggestion[];
    searchHistorySuggestions: Suggestion[];
    searchContextSuggestions: Suggestion[];
}

const SearchSuggestionsBox = forwardRef(({
    query,
    suggestionQuery,
    suggestionMode,
    onCompletion,
    isEnabled,
    cursorPosition,
    isFocused,
    onFocus,
    onBlur,
    onReturnFocus,
    isLoadingSuggestions,
    repoSuggestions,
    fileSuggestions,
    symbolSuggestions,
    languageSuggestions,
    searchHistorySuggestions,
    searchContextSuggestions,
}: SearchSuggestionsBoxProps, ref: Ref<HTMLDivElement>) => {
    const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(0);
    const { onOpenChanged } = useSyntaxGuide();

    const { suggestions, isHighlightEnabled, descriptionPlacement, DefaultIcon, onSuggestionClicked } = useMemo(() => {
        if (!isEnabled) {
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
            isClientSideSearchCaseSensitive = true,
            descriptionPlacement = "left",
            onSuggestionClicked,
            DefaultIcon,
        } = ((): {
            threshold?: number,
            limit?: number,
            list: Suggestion[],
            isHighlightEnabled?: boolean,
            isSpotlightEnabled?: boolean,
            isClientSideSearchEnabled?: boolean,
            isClientSideSearchCaseSensitive?: boolean,
            descriptionPlacement?: "left" | "right",
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
                        isClientSideSearchCaseSensitive: false,
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
                case "searchHistory":
                    return {
                        list: searchHistorySuggestions,
                        onSuggestionClicked: (value: string) => {
                            onCompletion(value, value.length, /* autoSubmit = */ true);
                        },
                        descriptionPlacement: "right",
                    }
                case "context":
                    return {
                        list: searchContextSuggestions,
                        onSuggestionClicked: createOnSuggestionClickedHandler(),
                        descriptionPlacement: "right",
                    }
                case "none":
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
            isCaseSensitive: isClientSideSearchCaseSensitive,
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
            descriptionPlacement,
            DefaultIcon,
            onSuggestionClicked,
        }

    }, [
        isEnabled,
        suggestionQuery,
        suggestionMode,
        query,
        cursorPosition,
        onCompletion,
        repoSuggestions,
        fileSuggestions,
        symbolSuggestions,
        searchHistorySuggestions,
        languageSuggestions,
    ]);

    // When the list of suggestions change, reset the highlight index
    useEffect(() => {
        setHighlightedSuggestionIndex(0);
    }, [suggestions]);

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
            case "searchHistory":
                return "Search history"
            case "context":
                return "Search contexts"
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
            <p className="text-muted-foreground text-sm mb-2">
                {suggestionModeText}
            </p>
            {isLoadingSuggestions ? (
                // Skeleton placeholder
                <div className="animate-pulse flex flex-col gap-2 px-1 py-0.5">
                    {
                        Array.from({ length: 10 }).map((_, index) => (
                            <Skeleton key={index} className="h-4 w-full" />
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
                        <span
                            className={clsx("text-muted-foreground font-light", {
                                "ml-auto": descriptionPlacement === "right",
                            })}
                        >
                            {result.description}
                        </span>
                    )}
                </div>
            ))}
            <Separator
                orientation="horizontal"
                className="my-2"
            />
            <div className="flex flex-row items-center justify-between mt-1">
                <div
                    className="flex flex-row gap-1.5 items-center cursor-pointer"
                    onClick={() => onOpenChanged(true)}
                >
                    <p className="text-muted-foreground text-sm">
                        Syntax help:
                    </p>
                    <div className="flex flex-row gap-0.5 items-center">
                        <KeyboardShortcutHint shortcut="⌘" />
                        <KeyboardShortcutHint shortcut="/" />
                    </div>
                </div>
                {isFocused && (
                    <span className="flex flex-row gap-1.5 items-center">
                        <KeyboardShortcutHint shortcut="↵" />
                        <span className="text-muted-foreground text-sm font-medium">
                            to select
                        </span>
                    </span>
                )}
            </div>
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