'use client';

import { useTailwind } from "@/hooks/useTailwind";
import { SearchQueryParams } from "@/lib/types";
import { cn, createPathWithQueryParams, isDefined } from "@/lib/utils";
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
import CodeMirror, { KeyBinding, keymap, ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { cva } from "class-variance-authority";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { useHotkeys } from 'react-hotkeys-hook';
import Fuse from "fuse.js";
import clsx from "clsx";
import { MixerVerticalIcon, CommitIcon } from "@radix-ui/react-icons"
import escapeStringRegexp from "escape-string-regexp";

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

const zoektLanguage = StreamLanguage.define({
    token: (stream) => {
        if (stream.match(/-?(file|branch|revision|rev|case|repo|lang|content|sym):/)) {
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
    "flex items-center w-full p-0.5 border rounded-md relative",
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

export const SearchBar = ({
    className,
    size,
    defaultQuery,
    autoFocus,
}: SearchBarProps) => {
    const router = useRouter();
    const tailwind = useTailwind();

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

    const [query, setQuery] = useState(defaultQuery ?? "");
    const editorRef = useRef<ReactCodeMirrorRef>(null);

    useHotkeys('/', (event) => {
        event.preventDefault();
        editorRef.current?.view?.focus();
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
                            setQuery((query) => {
                                if (suggestionQuery.length > 0) {
                                    query = query.slice(0, -suggestionQuery.length);
                                }
                                query = query + `^${escapeStringRegexp(value)}$` + " ";
                                return query;
                            });
                            editorRef.current?.view?.focus();
                            if (editorRef.current?.view) {
                                cursorDocEnd({
                                    state: editorRef.current.view.state,
                                    dispatch: editorRef.current.view.dispatch,
                                });
                            }
                        }
                    }
                case "filter":
                    return {
                        threshold: 0.1,
                        list: searchPrefixes,
                        isHighlightEnabled: true,
                        Icon: MixerVerticalIcon,
                        onSuggestionClicked: (value: string) => {
                            setQuery((query) => {
                                if (suggestionQuery.length > 0) {
                                    query = query.slice(0, -suggestionQuery.length);
                                }
                                query = query + value;
                                return query;
                            });
                            editorRef.current?.view?.focus();
                            if (editorRef.current?.view) {
                                cursorDocEnd({
                                    state: editorRef.current.view.state,
                                    dispatch: editorRef.current.view.dispatch,
                                });
                            }
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

    }, [suggestionQuery, suggestionMode]);

    return (
        <div
            className={cn(searchBarVariants({ size, className }))}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    onSubmit();
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
            <div
                className="w-full absolute z-10 top-12 border rounded-md bg-background drop-shadow-2xl p-2"
            >
                {suggestions && suggestions.length > 0 && (
                    <p className="text-muted-foreground text-sm mb-1">
                        {
                            suggestionMode === "filter" ? "Filter by" :
                            suggestionMode === "repo" ? "Repositories" :
                            ""
                        }
                    </p>
                )}
                {suggestions?.map((result, index) => (
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
        </div>
    )
}