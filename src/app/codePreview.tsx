'use client';

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useExtensionWithDependency } from "@/hooks/useExtensionWithDependency";
import { gutterWidthExtension } from "@/lib/extensions/gutterWidthExtension";
import { markMatches, searchResultHighlightExtension } from "@/lib/extensions/searchResultHighlightExtension";
import { ZoektMatch } from "@/lib/types";
import { defaultKeymap } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { search } from "@codemirror/search";
import { EditorView, keymap } from "@codemirror/view";
import { Cross1Icon, FileIcon } from "@radix-ui/react-icons";
import { Scrollbar } from "@radix-ui/react-scroll-area";
import { vim } from "@replit/codemirror-vim";
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { ArrowDown, ArrowUp } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface CodePreviewFile {
    content: string;
    filepath: string;
    matches: ZoektMatch[];
}

interface CodePreviewProps {
    file?: CodePreviewFile;
    keymapType: "default" | "vim";
    selectedMatchIndex: number;
    onSelectedMatchIndexChange: (index: number) => void;
    onClose: () => void;
}

export const CodePreview = ({
    file,
    keymapType,
    selectedMatchIndex,
    onSelectedMatchIndexChange,
    onClose,
}: CodePreviewProps) => {
    const editorRef = useRef<ReactCodeMirrorRef>(null);

    const { theme: _theme, systemTheme } = useTheme();

    const theme = useMemo(() => {
        if (_theme === "system") {
            return systemTheme ?? "light";
        }

        return _theme ?? "light";
    }, [_theme, systemTheme]);

    const [gutterWidth, setGutterWidth] = useState(0);

    const keymapExtension = useExtensionWithDependency(
        editorRef.current?.view ?? null,
        () => {
            switch (keymapType) {
                case "default":
                    return keymap.of(defaultKeymap);
                case "vim":
                    return vim();
            }
        },
        [keymapType]
    );

    const extensions = useMemo(() => {
        return [
            keymapExtension,
            gutterWidthExtension,
            javascript(),
            searchResultHighlightExtension(),
            search({
                top: true,
            }),
            EditorView.updateListener.of(update => {
                const width = update.view.plugin(gutterWidthExtension)?.width;
                if (width) {
                    setGutterWidth(width);
                }
            }),
        ];
    }, [keymapExtension]);

    useEffect(() => {
        if (!file || !editorRef.current?.view) {
            return;
        }

        markMatches(selectedMatchIndex, file.matches, editorRef.current.view);
    }, [file, selectedMatchIndex]);

    const onUpClicked = useCallback(() => {
        onSelectedMatchIndexChange(selectedMatchIndex - 1);
    }, [onSelectedMatchIndexChange, selectedMatchIndex]);

    const onDownClicked = useCallback(() => {
        onSelectedMatchIndexChange(selectedMatchIndex + 1);
    }, [onSelectedMatchIndexChange, selectedMatchIndex]);

    return (
        <div className="flex flex-col h-full">
            <div className="flex flex-row bg-cyan-200 dark:bg-cyan-900 items-center justify-between pr-3">
                <div className="flex flex-row">
                    <div
                        style={{ width: `${gutterWidth}px` }}
                        className="flex justify-center items-center"
                    >
                        <FileIcon className="h-4 w-4" />
                    </div>
                    <span>{file?.filepath}</span>
                </div>
                <div className="flex flex-row gap-1 items-center">
                    <p className="text-sm">{`${selectedMatchIndex + 1} of ${file?.matches.length}`}</p>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={selectedMatchIndex === 0}
                        onClick={onUpClicked}
                    >
                        <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={onDownClicked}
                        disabled={file ? selectedMatchIndex === file?.matches.length - 1 : true}
                    >
                        <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={onClose}
                    >
                        <Cross1Icon className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <ScrollArea className="h-full overflow-auto flex-1">
                <CodeMirror
                    ref={editorRef}
                    readOnly={true}
                    value={file?.content}
                    theme={theme === "dark" ? "dark" : "light"}
                    extensions={extensions}
                />
                <Scrollbar orientation="vertical" />
                <Scrollbar orientation="horizontal" />
            </ScrollArea>
        </div>
    )
}