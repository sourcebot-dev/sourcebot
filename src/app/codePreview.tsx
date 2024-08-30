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
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";

export interface CodePreviewFile {
    content: string;
    filepath: string;
    matches: ZoektMatch[];
}

interface CodePreviewProps {
    file?: CodePreviewFile;
    keymapType: "default" | "vim";
    onClose: () => void;
}

export const CodePreview = ({
    file,
    keymapType,
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

    useEffect(() => {
        if (!file || !editorRef.current?.view) {
            return;
        }

        markMatches(file.matches, editorRef.current.view);
    }, [file?.matches]);

    return (
        <div className="h-full">
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
                <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Cross1Icon
                        className="h-4 w-4"
                        onClick={onClose}
                    />
                </Button>
            </div>
            <ScrollArea className="h-full overflow-y-auto">
                <CodeMirror
                    ref={editorRef}
                    readOnly={true}
                    value={file?.content}
                    theme={theme === "dark" ? "dark" : "light"}
                    extensions={[
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
                        })
                    ]}
                />
                <Scrollbar orientation="vertical" />
            </ScrollArea>
        </div>
    )
}