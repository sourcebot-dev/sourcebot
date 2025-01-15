'use client';

import { EditorContextMenu } from "@/app/components/editorContextMenu";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useKeymapExtension } from "@/hooks/useKeymapExtension";
import { useSyntaxHighlightingExtension } from "@/hooks/useSyntaxHighlightingExtension";
import { useThemeNormalized } from "@/hooks/useThemeNormalized";
import { gutterWidthExtension } from "@/lib/extensions/gutterWidthExtension";
import { highlightRanges, searchResultHighlightExtension } from "@/lib/extensions/searchResultHighlightExtension";
import { SearchResultFileMatch } from "@/lib/types";
import { search } from "@codemirror/search";
import { EditorView } from "@codemirror/view";
import { Cross1Icon, FileIcon } from "@radix-ui/react-icons";
import { Scrollbar } from "@radix-ui/react-scroll-area";
import CodeMirror, { ReactCodeMirrorRef, SelectionRange } from '@uiw/react-codemirror';
import clsx from "clsx";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface CodePreviewFile {
    content: string;
    filepath: string;
    link?: string;
    matches: SearchResultFileMatch[];
    language: string;
    revision: string;
}

interface CodePreviewProps {
    file?: CodePreviewFile;
    repoName?: string;
    selectedMatchIndex: number;
    onSelectedMatchIndexChange: (index: number) => void;
    onClose: () => void;
}

export const CodePreview = ({
    file,
    repoName,
    selectedMatchIndex,
    onSelectedMatchIndexChange,
    onClose,
}: CodePreviewProps) => {
    const editorRef = useRef<ReactCodeMirrorRef>(null);

    const { theme } = useThemeNormalized();
    const [gutterWidth, setGutterWidth] = useState(0);

    const keymapExtension = useKeymapExtension(editorRef.current?.view);
    const syntaxHighlighting = useSyntaxHighlightingExtension(file?.language ?? '', editorRef.current?.view);
    const [currentSelection, setCurrentSelection] = useState<SelectionRange>();

    const extensions = useMemo(() => {
        return [
            keymapExtension,
            gutterWidthExtension,
            syntaxHighlighting,
            EditorView.lineWrapping,
            searchResultHighlightExtension(),
            search({
                top: true,
            }),
            EditorView.updateListener.of((update) => {
                const width = update.view.plugin(gutterWidthExtension)?.width;
                if (width) {
                    setGutterWidth(width);
                }
            }),
            EditorView.updateListener.of((update) => {
                // @note: it's important we reset the selection when
                // the document changes... otherwise we will get a floating
                // context menu where it shouldn't be.
                if (update.selectionSet || update.docChanged) {
                    setCurrentSelection(update.state.selection.main);
                }
            })
        ];
    }, [keymapExtension, syntaxHighlighting]);

    const ranges = useMemo(() => {
        if (!file || !file.matches.length) {
            return [];
        }

        return file.matches.flatMap((match) => {
            return match.Ranges;
        })
    }, [file]);

    useEffect(() => {
        if (!file || !editorRef.current?.view) {
            return;
        }

        highlightRanges(selectedMatchIndex, ranges, editorRef.current.view);
    }, [ranges, selectedMatchIndex, file]);

    const onUpClicked = useCallback(() => {
        onSelectedMatchIndexChange(selectedMatchIndex - 1);
    }, [onSelectedMatchIndexChange, selectedMatchIndex]);

    const onDownClicked = useCallback(() => {
        onSelectedMatchIndexChange(selectedMatchIndex + 1);
    }, [onSelectedMatchIndexChange, selectedMatchIndex]);

    return (
        <div className="flex flex-col h-full">
            <div className="flex flex-row bg-cyan-200 dark:bg-cyan-900 items-center justify-between pr-3 py-0.5">

                {/* Gutter icon */}
                <div className="flex flex-row">
                    <div
                        style={{ width: `${gutterWidth}px` }}
                        className="flex justify-center items-center"
                    >
                        <FileIcon className="h-4 w-4" />
                    </div>
                </div>

                {/* File path */}
                <div className="flex-1 overflow-hidden">
                    <span
                        className={clsx("block truncate-start text-sm font-mono", {
                            "cursor-pointer text-blue-500 hover:underline": file?.link
                        })}
                        onClick={() => {
                            if (file?.link) {
                                window.open(file.link, "_blank");
                            }
                        }}
                        title={file?.filepath}
                    >
                        {file?.filepath}
                    </span>
                </div>

                <div className="flex flex-row gap-1 items-center pl-2">
                    {/* Match selector */}
                    {file && file.matches.length > 0 && (
                        <>
                            <p className="text-sm">{`${selectedMatchIndex + 1} of ${ranges.length}`}</p>
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
                                disabled={file ? selectedMatchIndex === ranges.length - 1 : true}
                            >
                                <ArrowDown className="h-4 w-4" />
                            </Button>
                        </>
                    )}

                    {/* Close button */}
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
                    className="relative"
                    readOnly={true}
                    value={file?.content}
                    theme={theme === "dark" ? "dark" : "light"}
                    extensions={extensions}
                >
                    {
                        editorRef.current?.view &&
                        file?.filepath &&
                        repoName &&
                        currentSelection &&
                        (
                            <EditorContextMenu
                                view={editorRef.current.view}
                                path={file?.filepath}
                                repoName={repoName}
                                selection={currentSelection}
                                revisionName={file.revision}
                            />
                        )
                    }
                </CodeMirror>
                <Scrollbar orientation="vertical" />
                <Scrollbar orientation="horizontal" />
            </ScrollArea>
        </div>
    )
}