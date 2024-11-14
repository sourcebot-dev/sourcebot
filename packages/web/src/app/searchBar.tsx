'use client';

import { useTailwind } from "@/hooks/useTailwind";
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
import { LanguageSupport, StreamLanguage } from "@codemirror/language";
import { tags as t } from '@lezer/highlight';
import { createTheme } from '@uiw/codemirror-themes';
import CodeMirror, { KeyBinding, keymap, ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { cva } from "class-variance-authority";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { useHotkeys } from 'react-hotkeys-hook';
import Fuse from "fuse.js";

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

const searchPrefixes = [
    "repo:",
    "-repo:",
    "file:",
    "-file:"
];

const repos = [
    "github.com/git/git",
    "github.com/golang/go",
    "github.com/torvalds/linux",
    "github.com/microsoft/vscode",
    "github.com/microsoft/vscode-docs",
    "github.com/rust-lang/rust",
]

type SuggestionMode = "none" | "repo";

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

    const { allSuggestions, suggestionQuery } = useMemo<{ allSuggestions: string[], suggestionQuery: string }>(() => {
        const queryParts = query.split(" ");
        if (queryParts.length === 0) {
            return {
                allSuggestions: [],
                suggestionQuery: "",
            }
        }
        const end = queryParts[queryParts.length - 1];

        if (end.startsWith("repo:") || end.startsWith("-repo:")) {
            const index = end.indexOf(":");
            return {
                allSuggestions: repos,
                suggestionQuery: end.substring(index + 1),
            }
        }

        return {
            allSuggestions: searchPrefixes,
            suggestionQuery: end,
        }
    }, [query]);

    const suggestions = useMemo(() => {
        if (suggestionQuery.length === 0) {
            return allSuggestions.slice(0, 10);
        }

        const fuse = new Fuse(allSuggestions, {
            threshold: 0.1,
        });

        const results = fuse
            .search(suggestionQuery, {
                limit: 10,
            })
            .map(result => result.item);

        return results;

    }, [suggestionQuery, allSuggestions]);

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
                {suggestions.map((result, index) => (
                    <div
                        key={index}
                        className="font-mono text-sm"
                    >
                        <span className="text-highlight">{result}</span>
                        <span>{' Include only results from the given ...'}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}