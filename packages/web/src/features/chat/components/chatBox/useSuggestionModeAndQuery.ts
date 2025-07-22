'use client';

import { word } from "@/features/chat/utils";
import { useEffect, useMemo } from "react";
import { Editor, Range } from "slate";
import { SuggestionMode } from "./types";
import { useSlate, useSlateSelection } from "slate-react";
import { usePrevious } from "@uidotdev/usehooks";


export const useSuggestionModeAndQuery = () => {
    const selection = useSlateSelection();
    const editor = useSlate();
    
    const { suggestionQuery, suggestionMode, range } = useMemo<{
        suggestionQuery: string;
        suggestionMode: SuggestionMode;
        range: Range | null;
    }>(() => {
        if (!selection || !Range.isCollapsed(selection)) {
            return {
                suggestionMode: "none",
                suggestionQuery: '',
                range: null,
            };
        }

        const range = word(editor, selection, {
            terminator: [' '],
            directions: 'both',
        });

        if (!range) {
            return {
                suggestionMode: "none",
                suggestionQuery: '',
                range: null,
            };
        }

        const text = Editor.string(editor, range);

        let match: RegExpMatchArray | null = null;

        // Refine mode.
        match = text.match(/^@$/);
        if (match) {
            return {
                suggestionMode: "refine",
                suggestionQuery: '',
                range,
            };
        }

        // File mode.
        match = text.match(/^@file:(.*)$/);
        if (match) {
            return {
                suggestionMode: "file",
                suggestionQuery: match[1],
                range,
            };
        }

        // If the user starts typing, fallback to file mode.
        // In the future, it would be nice to have a "all" mode that
        // searches across all mode types.
        match = text.match(/^@(.*)$/);
        if (match) {
            return {
                suggestionMode: "file",
                suggestionQuery: match[1],
                range,
            };
        }

        // Default to none mode.
        return {
            suggestionMode: "none",
            suggestionQuery: '',
            range: null,
        };
    }, [editor, selection]);

    // Debug logging.
    const previousSuggestionMode = usePrevious(suggestionMode);
    useEffect(() => {
        if (previousSuggestionMode !== suggestionMode) {
            console.debug(`Suggestion mode changed: ${previousSuggestionMode} -> ${suggestionMode}`);
        }
    }, [previousSuggestionMode, suggestionMode])

    return {
        suggestionQuery,
        suggestionMode,
        range,
    }
}