'use client';

import { useEffect, useMemo, useState } from "react";
import { splitQuery, SuggestionMode } from "./searchSuggestionsBox";
import { useSuggestionModeMappings } from "./useSuggestionModeMappings";

interface Props {
    isSuggestionsEnabled: boolean;
    isHistorySearchEnabled: boolean;
    cursorPosition: number;
    query: string;
}

export const useSuggestionModeAndQuery = ({
    isSuggestionsEnabled,
    isHistorySearchEnabled,
    cursorPosition,
    query,
}: Props) => {

    const suggestionModeMappings = useSuggestionModeMappings();

    const { suggestionQuery, suggestionMode } = useMemo<{ suggestionQuery: string, suggestionMode: SuggestionMode }>(() => {
        // When suggestions are not enabled, fallback to using a sentinal
        // suggestion mode of "none".
        if (!isSuggestionsEnabled) {
            return {
                suggestionQuery: "",
                suggestionMode: "none",
            };
        }

        if (isHistorySearchEnabled) {
            return {
                suggestionQuery: query,
                suggestionMode: "searchHistory"
            }
        }

        // @note: bounds check is not required here since `splitQuery`
        // guarantees that invariant as a assertion. 
        const { queryParts, cursorIndex } = splitQuery(query, cursorPosition);
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
    }, [cursorPosition, isSuggestionsEnabled, query, isHistorySearchEnabled, suggestionModeMappings]);

    // Debug logging for tracking mode transitions.
    const [prevSuggestionMode, setPrevSuggestionMode] = useState<SuggestionMode>("none");
    useEffect(() => {
        if (prevSuggestionMode !== suggestionMode) {
            console.debug(`Suggestion mode changed: ${prevSuggestionMode} -> ${suggestionMode}`);
        }
        setPrevSuggestionMode(suggestionMode);
    }, [prevSuggestionMode, suggestionMode]);


    return {
        suggestionMode,
        suggestionQuery,
    }
}