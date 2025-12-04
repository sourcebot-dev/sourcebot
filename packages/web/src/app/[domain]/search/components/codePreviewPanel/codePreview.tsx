'use client';

import { useBrowseNavigation } from "@/app/[domain]/browse/hooks/useBrowseNavigation";
import { EditorContextMenu } from "@/app/[domain]/components/editorContextMenu";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SymbolHoverPopup } from "@/ee/features/codeNav/components/symbolHoverPopup";
import { symbolHoverTargetsExtension } from "@/ee/features/codeNav/components/symbolHoverPopup/symbolHoverTargetsExtension";
import { useHasEntitlement } from "@/features/entitlements/useHasEntitlement";
import { SearchResultChunk } from "@/features/search";
import { useCodeMirrorLanguageExtension } from "@/hooks/useCodeMirrorLanguageExtension";
import { useCodeMirrorTheme } from "@/hooks/useCodeMirrorTheme";
import { useKeymapExtension } from "@/hooks/useKeymapExtension";
import { gutterWidthExtension } from "@/lib/extensions/gutterWidthExtension";
import { highlightRanges, searchResultHighlightExtension } from "@/lib/extensions/searchResultHighlightExtension";
import { search } from "@codemirror/search";
import { EditorView } from "@codemirror/view";
import { Cross1Icon, FileIcon } from "@radix-ui/react-icons";
import { Scrollbar } from "@radix-ui/react-scroll-area";
import CodeMirror, { ReactCodeMirrorRef, SelectionRange } from '@uiw/react-codemirror';
import { ArrowDown, ArrowUp } from "lucide-react";
import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from "react";

export interface CodePreviewFile {
    content: string;
    filepath: string;
    link?: string;
    matches: SearchResultChunk[];
    language: string;
    revision: string;
}

interface CodePreviewProps {
    file: CodePreviewFile;
    repoName: string;
    selectedMatchIndex: number;
    onSelectedMatchIndexChange: Dispatch<SetStateAction<number>>;
    onClose: () => void;
}

export const CodePreview = ({
    file,
    repoName,
    selectedMatchIndex,
    onSelectedMatchIndexChange,
    onClose,
}: CodePreviewProps) => {
    const [editorRef, setEditorRef] = useState<ReactCodeMirrorRef | null>(null);
    const { navigateToPath } = useBrowseNavigation();
    const hasCodeNavEntitlement = useHasEntitlement("code-nav");

    const [gutterWidth, setGutterWidth] = useState(0);
    const theme = useCodeMirrorTheme();

    const keymapExtension = useKeymapExtension(editorRef?.view);
    const languageExtension = useCodeMirrorLanguageExtension(file?.language ?? '', editorRef?.view);
    const [currentSelection, setCurrentSelection] = useState<SelectionRange>();

    const extensions = useMemo(() => {
        return [
            keymapExtension,
            gutterWidthExtension,
            languageExtension,
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
            }),
            hasCodeNavEntitlement ? symbolHoverTargetsExtension : [],
        ];
    }, [hasCodeNavEntitlement, keymapExtension, languageExtension]);

    const ranges = useMemo(() => {
        if (!file.matches.length) {
            return [];
        }

        return file.matches.flatMap((match) => {
            return match.matchRanges;
        })
    }, [file]);

    useEffect(() => {
        if (!editorRef?.view) {
            return;
        }

        highlightRanges(selectedMatchIndex, ranges, editorRef.view);
    }, [ranges, selectedMatchIndex, file, editorRef]);

    const onUpClicked = useCallback(() => {
        onSelectedMatchIndexChange((prev) => prev - 1);
    }, [onSelectedMatchIndexChange]);

    const onDownClicked = useCallback(() => {
        onSelectedMatchIndexChange((prev) => prev + 1);
    }, [onSelectedMatchIndexChange]);

    return (
        <div className="flex flex-col h-full">
            <div className="flex flex-row bg-accent items-center justify-between pr-3 py-0.5 mt-7">

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
                        className="block truncate-start text-sm font-mono cursor-pointer hover:underline"
                        onClick={() => {
                            navigateToPath({
                                repoName,
                                path: file.filepath,
                                pathType: 'blob',
                                revisionName: file.revision,
                            });
                        }}
                        title={file.filepath}
                    >
                        {file.filepath}
                    </span>
                </div>

                <div className="flex flex-row gap-1 items-center pl-2">
                    {/* Match selector */}
                    {file.matches.length > 0 && (
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
                                disabled={selectedMatchIndex === ranges.length - 1}
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
                    ref={setEditorRef}
                    className="relative"
                    readOnly={true}
                    value={file?.content}
                    extensions={extensions}
                    theme={theme}
                >
                    {
                        editorRef?.view &&
                        file?.filepath &&
                        repoName &&
                        currentSelection &&
                        (
                            <EditorContextMenu
                                view={editorRef.view}
                                path={file?.filepath}
                                repoName={repoName}
                                selection={currentSelection}
                                revisionName={file.revision}
                            />
                        )
                    }

                    {editorRef && hasCodeNavEntitlement && (
                        <SymbolHoverPopup
                            source="preview"
                            editorRef={editorRef}
                            language={file.language}
                            revisionName={file.revision}
                            fileName={file.filepath}
                            repoName={repoName}
                        />
                    )}
                </CodeMirror>
                <Scrollbar orientation="vertical" />
                <Scrollbar orientation="horizontal" />
            </ScrollArea>
        </div>
    )
}