'use client';

import { useTailwind } from "@/hooks/useTailwind";
import { Repository, SearchQueryParams } from "@/lib/types";
import { cn, createPathWithQueryParams } from "@/lib/utils";
import {
    cursorCharLeft,
    cursorCharRight,
    cursorDocEnd,
    cursorDocStart,
    cursorLineBoundaryBackward,
    cursorLineBoundaryForward,
    deleteCharBackward,
    deleteCharForward,
    deleteGroupBackward,
    deleteGroupForward,
    deleteLineBoundaryBackward,
    deleteLineBoundaryForward,
    history,
    historyKeymap,
    selectAll,
    selectCharLeft,
    selectCharRight,
    selectDocEnd,
    selectDocStart,
    selectLineBoundaryBackward,
    selectLineBoundaryForward
} from "@codemirror/commands";
import { LanguageSupport, StreamLanguage } from "@codemirror/language";
import { tags as t } from '@lezer/highlight';
import { createTheme } from '@uiw/codemirror-themes';
import CodeMirror, { Annotation, EditorView, KeyBinding, keymap, ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { cva } from "class-variance-authority";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from 'react-hotkeys-hook';
import { SearchSuggestionsBox } from "./searchSuggestionsBox";
import { useClickListener } from "@/hooks/useClickListener";
import { getRepos } from "../api/(client)/client";

interface SearchBarProps {
    className?: string;
    size?: "default" | "sm";
    defaultQuery?: string;
    autoFocus?: boolean;
}

const searchBarKeymap: readonly KeyBinding[] = ([
    { key: "ArrowLeft", run: cursorCharLeft, shift: selectCharLeft, preventDefault: true },
    { key: "ArrowRight", run: cursorCharRight, shift: selectCharRight, preventDefault: true },

    { key: "Home", run: cursorLineBoundaryBackward, shift: selectLineBoundaryBackward, preventDefault: true },
    { key: "Mod-Home", run: cursorDocStart, shift: selectDocStart },

    { key: "End", run: cursorLineBoundaryForward, shift: selectLineBoundaryForward, preventDefault: true },
    { key: "Mod-End", run: cursorDocEnd, shift: selectDocEnd },

    { key: "Mod-a", run: selectAll },

    { key: "Backspace", run: deleteCharBackward, shift: deleteCharBackward },
    { key: "Delete", run: deleteCharForward },
    { key: "Mod-Backspace", mac: "Alt-Backspace", run: deleteGroupBackward },
    { key: "Mod-Delete", mac: "Alt-Delete", run: deleteGroupForward },
    { mac: "Mod-Backspace", run: deleteLineBoundaryBackward },
    { mac: "Mod-Delete", run: deleteLineBoundaryForward }
] as KeyBinding[]).concat(historyKeymap);

// @todo: refactor this into a seperate extension file.
const zoektLanguage = StreamLanguage.define({
    token: (stream) => {
        if (stream.match(/-?(file|branch|revision|rev|case|repo|lang|content|sym|archived|fork|public):/)) {
            return t.keyword.toString();
        }

        if (stream.match(/\bor\b/)) {
            return t.keyword.toString();
        }

        stream.next();
        return null;
    },
});

const zoekt = () => {
    return new LanguageSupport(zoektLanguage);
}

const searchBarContainerVariants = cva(
    "search-bar-container flex items-center w-full p-0.5 border rounded-md relative",
    {
        variants: {
            size: {
                default: "h-10",
                sm: "h-8"
            }
        },
        defaultVariants: {
            size: "default",
        }
    }
);

export const SearchBar = ({
    className,
    size,
    defaultQuery,
    autoFocus,
}: SearchBarProps) => {
    const router = useRouter();
    const tailwind = useTailwind();
    const [ isSuggestionsBoxVisible, setIsSuggestionsBoxVisible ] = useState(false);
    const suggestionBoxRef = useRef<HTMLDivElement>(null);
    const [cursorPosition, setCursorPosition] = useState(0);

    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const [query, setQuery] = useState(defaultQuery ?? "");

    const [repos, setRepos] = useState<Repository[]>([]);

    const [isSuggestionBoxFocused, setIsSuggestionBoxFocused] = useState(false);

    const focusEditor = useCallback(() => editorRef.current?.view?.focus(), []);
    const focusSuggestionsBox = useCallback(() => suggestionBoxRef.current?.focus(), []);

    useEffect(() => {
        getRepos().then((response) => {
            setRepos(response.List.Repos.map(r => r.Repository));
        });
    }, []);

    const suggestionData = useMemo(() => ({
        repos,
    }), [repos]);

    const theme = useMemo(() => {
        return createTheme({
            theme: 'light',
            settings: {
                background: tailwind.theme.colors.background,
                foreground: tailwind.theme.colors.foreground,
                caret: '#AEAFAD',
            },
            styles: [
                {
                    tag: t.keyword,
                    color: tailwind.theme.colors.highlight,
                },
            ],
        });
    }, [tailwind]);

    const extensions = useMemo(() => {
        return [
            keymap.of(searchBarKeymap),
            history(),
            zoekt(),
            EditorView.updateListener.of(update => {
                if (update.selectionSet) {
                    const selection = update.state.selection.main;
                    if (selection.empty) {
                        setCursorPosition(selection.anchor);
                    }
                }
            })
        ];
    }, []);

    useHotkeys('/', (event) => {
        event.preventDefault();
        focusEditor();

        // Move the cursor to the end of the query
        if (editorRef.current?.view) {
            cursorDocEnd({
                state: editorRef.current.view.state,
                dispatch: editorRef.current.view.dispatch,
            });
        }
    });

    const onSubmit = () => {
        const url = createPathWithQueryParams('/search',
            [SearchQueryParams.query, query],
        )
        router.push(url);
    }

    useClickListener('.search-bar-container', (isElementClicked) => {
        // Collapse the suggestions box if the user clicks outside of the search bar container.
        if (!isElementClicked) {
            setIsSuggestionsBoxVisible(false);
        } else {
            setIsSuggestionsBoxVisible(true);
        }
    });

    return (
        <div
            className={cn(searchBarContainerVariants({ size, className }))}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    onSubmit();
                }

                if (e.key === 'Escape') {
                    e.preventDefault();
                    setIsSuggestionsBoxVisible(false);
                }

                if (e.key === 'ArrowDown') {
                    focusSuggestionsBox();
                }
            }}
        >
            <CodeMirror
                ref={editorRef}
                className="grow"
                placeholder={"Search..."}
                value={query}
                onChange={(value) => {
                    setQuery(value);
                }}
                theme={theme}
                basicSetup={false}
                extensions={extensions}
                indentWithTab={false}
                autoFocus={autoFocus ?? false}
            />
            <SearchSuggestionsBox
                ref={suggestionBoxRef}
                query={query}
                onCompletion={(cb) => {
                    const { newQuery, newCursorPosition } = cb(query);
                    setQuery(newQuery);

                    // Move the cursor to it's new position.
                    // @note : normally, react-codemirror handles syncing `query`
                    // and the document state, but this happens on re-render. Since
                    // we want to move the cursor before the component re-renders,
                    // we manually update the document state inline.
                    editorRef.current?.view?.dispatch({
                        changes: { from: 0, to: query.length, insert: newQuery },
                        annotations: [Annotation.define<boolean>().of(true)],
                    });

                    editorRef.current?.view?.dispatch({
                        selection: { anchor: newCursorPosition, head: newCursorPosition },
                    });

                    // Re-focus the editor since suggestions cause focus to be lost (both click & keyboard)
                    editorRef.current?.view?.focus();
                }}
                isVisible={isSuggestionsBoxVisible}
                onVisibilityChanged={setIsSuggestionsBoxVisible}
                onReturnFocus={() => {
                    // Re-focus the editor
                    focusEditor();
                }}
                isFocused={isSuggestionBoxFocused}
                onFocus={() => {
                    setIsSuggestionBoxFocused(document.activeElement === suggestionBoxRef.current);
                }}
                onBlur={() => {
                    setIsSuggestionBoxFocused(document.activeElement === suggestionBoxRef.current);
                }}
                cursorPosition={cursorPosition}
                data={suggestionData}
            />
        </div>
    )
}