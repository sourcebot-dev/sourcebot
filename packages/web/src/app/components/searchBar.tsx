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
import CodeMirror, { Annotation, KeyBinding, keymap, ReactCodeMirrorRef } from "@uiw/react-codemirror";
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

const zoekt = () =>{
    return new LanguageSupport(zoektLanguage);
}

const extensions = [
    keymap.of(searchBarKeymap),
    history(),
    zoekt()
];

const searchBarVariants = cva(
    "search-bar flex items-center w-full p-0.5 border rounded-md relative",
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
    const [ highlightedSuggestionIndex, setHighlightedSuggestionIndex ] = useState(0);

    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const [query, setQuery] = useState(defaultQuery ?? "");

    const [repos, setRepos] = useState<Repository[]>([]);
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
    

    const moveCursorToEnd = useCallback(() => {
        editorRef.current?.view?.focus();
        if (editorRef.current?.view) {
            cursorDocEnd({
                state: editorRef.current.view.state,
                dispatch: editorRef.current.view.dispatch,
            });
        }
    }, []);

    useHotkeys('/', (event) => {
        event.preventDefault();
        moveCursorToEnd();
    });

    const onSubmit = () => {
        const url = createPathWithQueryParams('/search',
            [SearchQueryParams.query, query],
        )
        router.push(url);
    }

    useClickListener('.search-bar', (isElementClicked) => {
        if (!isElementClicked) {
            setIsSuggestionsBoxVisible(false);
        }
    })

    return (
        <div
            className={cn(searchBarVariants({ size, className }))}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    onSubmit();
                }

                if (e.key === 'Escape') {
                    e.preventDefault();
                    setIsSuggestionsBoxVisible(false);
                }

                // @todo: probably move this logic into the SearchSuggestionsBox component.
                // See if we can read key state down there.
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setHighlightedSuggestionIndex((curIndex) => {
                        return curIndex + 1;
                    });
                }

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setHighlightedSuggestionIndex((curIndex) => {
                        return curIndex - 1;
                    });
                }

            }}
            onClick={() => {
                setIsSuggestionsBoxVisible(true);
                moveCursorToEnd();
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
                query={query}
                onCompletion={(cb) => {
                    const newQuery = cb(query);
                    setQuery(newQuery);

                    // Move the cursor to the end of the query
                    // @note : normally, react-codemirror handles syncing `query`
                    // and the document state, but this happens on re-render. Since
                    // we want to move the cursor to the end of the query before
                    // the component re-renders, we manually update the document
                    // state inline.
                    editorRef.current?.view?.dispatch({
                        changes: { from: 0, to: query.length, insert: newQuery },
                        annotations: [Annotation.define<boolean>().of(true)],
                    });
                    moveCursorToEnd();
                }}
                isVisible={isSuggestionsBoxVisible}
                setIsVisible={setIsSuggestionsBoxVisible}
                data={suggestionData}
            />
        </div>
    )
}