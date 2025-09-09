'use client';

import { useClickListener } from "@/hooks/useClickListener";
import { SearchQueryParams } from "@/lib/types";
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
import { tags as t } from '@lezer/highlight';
import { createTheme } from '@uiw/codemirror-themes';
import CodeMirror, { Annotation, EditorView, KeyBinding, keymap, ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { cva } from "class-variance-authority";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from 'react-hotkeys-hook';
import { SearchSuggestionsBox } from "./searchSuggestionsBox";
import { useSuggestionsData } from "./useSuggestionsData";
import { zoekt } from "./zoektLanguageExtension";
import { CounterClockwiseClockIcon } from "@radix-ui/react-icons";
import { useSuggestionModeAndQuery } from "./useSuggestionModeAndQuery";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Toggle } from "@/components/ui/toggle";
import { useDomain } from "@/hooks/useDomain";
import { KeyboardShortcutHint } from "@/app/components/keyboardShortcutHint";
import { createAuditAction } from "@/ee/features/audit/actions";
import tailwind from "@/tailwind";

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

const searchBarContainerVariants = cva(
    "search-bar-container flex items-center justify-center py-0.5 px-2 border rounded-md relative",
    {
        variants: {
            size: {
                default: "min-h-10",
                sm: "min-h-8"
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
    const domain = useDomain();
    const suggestionBoxRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const [cursorPosition, setCursorPosition] = useState(0);
    const [isSuggestionsEnabled, setIsSuggestionsEnabled] = useState(false);
    const [isSuggestionsBoxFocused, setIsSuggestionsBoxFocused] = useState(false);
    const [isHistorySearchEnabled, setIsHistorySearchEnabled] = useState(false);

    const focusEditor = useCallback(() => editorRef.current?.view?.focus(), []);
    const focusSuggestionsBox = useCallback(() => suggestionBoxRef.current?.focus(), []);

    const [_query, setQuery] = useState(defaultQuery ?? "");
    const query = useMemo(() => {
        // Replace any newlines with spaces to handle
        // copy & pasting text with newlines.
        return _query.replaceAll(/\n/g, " ");
    }, [_query]);

    // When the user navigates backwards/forwards while on the
    // search page (causing the `query` search param to change),
    // we want to update what query is displayed in the search bar.
    useEffect(() => {
        if (defaultQuery) {
            setQuery(defaultQuery);
        }
    }, [defaultQuery])

    const { suggestionMode, suggestionQuery } = useSuggestionModeAndQuery({
        isSuggestionsEnabled,
        isHistorySearchEnabled,
        cursorPosition,
        query,
    });

    const suggestionData = useSuggestionsData({
        suggestionMode,
        suggestionQuery,
    });

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
                {
                    tag: t.string,
                    color: '#2aa198',
                },
                {
                    tag: t.operator,
                    color: '#d33682',
                },
                {
                    tag: t.paren,
                    color: tailwind.theme.colors.highlight,
                },
            ],
        });
    }, []);

    const extensions = useMemo(() => {
        return [
            keymap.of(searchBarKeymap),
            history(),
            zoekt(),
            EditorView.lineWrapping,
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

    // Hotkey to focus the search bar.
    useHotkeys('/', (event) => {
        event.preventDefault();
        focusEditor();
        setIsSuggestionsEnabled(true);
        if (editorRef.current?.view) {
            cursorDocEnd({
                state: editorRef.current.view.state,
                dispatch: editorRef.current.view.dispatch,
            });
        }
    });

    // Collapse the suggestions box if the user clicks outside of the search bar container.
    useClickListener('.search-bar-container', (isElementClicked) => {
        if (!isElementClicked) {
            setIsSuggestionsEnabled(false);
        } else {
            setIsSuggestionsEnabled(true);
        }
    });

    const onSubmit = useCallback((query: string) => {
        setIsSuggestionsEnabled(false);
        setIsHistorySearchEnabled(false);

        createAuditAction({
            action: "user.performed_code_search",
            metadata: {
                message: query,
            },
        }, domain)

        const url = createPathWithQueryParams(`/${domain}/search`,
            [SearchQueryParams.query, query],
        );
        router.push(url);
    }, [domain, router]);

    return (
        <div
            className={cn(searchBarContainerVariants({ size, className }))}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    setIsSuggestionsEnabled(false);
                    onSubmit(query);
                }

                if (e.key === 'Escape') {
                    e.preventDefault();
                    setIsSuggestionsEnabled(false);
                }

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setIsSuggestionsEnabled(true);
                    focusSuggestionsBox();
                }

                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                }
            }}
        >
            <SearchHistoryButton
                isToggled={isHistorySearchEnabled}
                onClick={() => {
                    setQuery("");
                    setIsHistorySearchEnabled(!isHistorySearchEnabled);
                    setIsSuggestionsEnabled(true);
                    focusEditor();
                }}
            />
            <Separator
                className="mx-1 h-6"
                orientation="vertical"
            />
            <CodeMirror
                ref={editorRef}
                className="w-full"
                placeholder={isHistorySearchEnabled ? "Filter history..." : "Search (/) through repos..."}
                value={query}
                onChange={(value) => {
                    setQuery(value);
                    // Whenever the user types, we want to re-enable
                    // the suggestions box.
                    setIsSuggestionsEnabled(true);
                }}
                theme={theme}
                basicSetup={false}
                extensions={extensions}
                indentWithTab={false}
                autoFocus={autoFocus ?? false}
            />
            <Tooltip
                delayDuration={100}
            >
                <TooltipTrigger asChild>
                    <div>
                        <KeyboardShortcutHint shortcut="/" />
                    </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="flex flex-row items-center gap-2">
                    Focus search bar
                </TooltipContent>
            </Tooltip>
            <SearchSuggestionsBox
                ref={suggestionBoxRef}
                query={query}
                suggestionQuery={suggestionQuery}
                suggestionMode={suggestionMode}
                onCompletion={(newQuery: string, newCursorPosition: number, autoSubmit = false) => {
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

                    if (autoSubmit) {
                        onSubmit(newQuery);
                    }
                }}
                isEnabled={isSuggestionsEnabled}
                onReturnFocus={() => {
                    focusEditor();
                }}
                isFocused={isSuggestionsBoxFocused}
                onFocus={() => {
                    setIsSuggestionsBoxFocused(document.activeElement === suggestionBoxRef.current);
                }}
                onBlur={() => {
                    setIsSuggestionsBoxFocused(document.activeElement === suggestionBoxRef.current);
                }}
                cursorPosition={cursorPosition}
                {...suggestionData}
            />
        </div>
    )
}

const SearchHistoryButton = ({
    isToggled,
    onClick,
}: {
    isToggled: boolean,
    onClick: () => void
}) => {
    return (
        <Tooltip>
            <TooltipTrigger
                asChild={true}
            >
                {/* @see : https://github.com/shadcn-ui/ui/issues/1988#issuecomment-1980597269 */}
                <div>
                    <Toggle
                        pressed={isToggled}
                        className="h-6 w-6 min-w-6 px-0 p-1 cursor-pointer"
                        onClick={onClick}
                    >
                        <CounterClockwiseClockIcon />
                    </Toggle>
                </div>
            </TooltipTrigger>
            <TooltipContent
                side="bottom"
            >
                Search history
            </TooltipContent>
        </Tooltip>
    )
}
