'use client';

import { useThemeNormalized } from "@/hooks/useThemeNormalized";
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
import CodeMirror, { KeyBinding, keymap, ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { cva } from "class-variance-authority";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useHotkeys } from 'react-hotkeys-hook';

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

interface SearchBarProps {
    className?: string;
    size?: "default" | "sm";
    defaultQuery?: string;
    autoFocus?: boolean;
}


const searchBarVariants = cva(
    "flex items-center w-full p-0.5 border rounded-md",
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
)

export const SearchBar = ({
    className,
    size,
    defaultQuery,
    autoFocus,
}: SearchBarProps) => {

    const [query, setQuery] = useState(defaultQuery ?? "");
    const { theme } = useThemeNormalized();
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

    const router = useRouter();

    const onSubmit = () => {
        const url = createPathWithQueryParams('/search',
            [SearchQueryParams.query, query],
        )
        router.push(url);
    }

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
                theme={theme === 'dark' ? 'dark' : 'light'}
                basicSetup={false}
                extensions={[
                    keymap.of(searchBarKeymap),
                    history(),
                ]}
                indentWithTab={false}
                autoFocus={autoFocus ?? false}
            />
        </div>
    )
}