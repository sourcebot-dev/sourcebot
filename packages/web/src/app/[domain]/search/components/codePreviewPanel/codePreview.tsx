'use client';

import { EditorContextMenu } from "@/app/[domain]/components/editorContextMenu";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchResultChunk } from "@/features/search/types";
import { useCodeMirrorTheme } from "@/hooks/useCodeMirrorTheme";
import { useKeymapExtension } from "@/hooks/useKeymapExtension";
import { useCodeMirrorLanguageExtension } from "@/hooks/useCodeMirrorLanguageExtension";
import { gutterWidthExtension } from "@/lib/extensions/gutterWidthExtension";
import { highlightRanges, searchResultHighlightExtension } from "@/lib/extensions/searchResultHighlightExtension";
import { search } from "@codemirror/search";
import { EditorView } from "@codemirror/view";
import { Cross1Icon, FileIcon } from "@radix-ui/react-icons";
import { Scrollbar } from "@radix-ui/react-scroll-area";
import CodeMirror, { ReactCodeMirrorRef, SelectionRange } from '@uiw/react-codemirror';
import { ArrowDown, ArrowUp } from "lucide-react";
import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from "react";
import { useBrowseNavigation } from "@/app/[domain]/browse/hooks/useBrowseNavigation";
import { SymbolHoverPopup } from "@/ee/features/codeNav/components/symbolHoverPopup";
import { symbolHoverTargetsExtension } from "@/ee/features/codeNav/components/symbolHoverPopup/symbolHoverTargetsExtension";
import { useHasEntitlement } from "@/features/entitlements/useHasEntitlement";
import { SymbolDefinition } from "@/ee/features/codeNav/components/symbolHoverPopup/useHoveredOverSymbolInfo";
import { createAuditAction } from "@/ee/features/audit/actions";
import { useDomain } from "@/hooks/useDomain";

import useCaptureEvent from "@/hooks/useCaptureEvent";

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
    const domain = useDomain();

    const [gutterWidth, setGutterWidth] = useState(0);
    const theme = useCodeMirrorTheme();

    const keymapExtension = useKeymapExtension(editorRef?.view);
    const languageExtension = useCodeMirrorLanguageExtension(file?.language ?? '', editorRef?.view);
    const [currentSelection, setCurrentSelection] = useState<SelectionRange>();

    const captureEvent = useCaptureEvent();

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

    const onGotoDefinition = useCallback((symbolName: string, symbolDefinitions: SymbolDefinition[]) => {
        captureEvent('wa_goto_definition_pressed', {
            source: 'preview',
        });
        createAuditAction({
            action: "user.performed_goto_definition",
            metadata: {
                message: symbolName,
            },
        }, domain)

        if (symbolDefinitions.length === 0) {
            return;
        }

        if (symbolDefinitions.length === 1) {
            const symbolDefinition = symbolDefinitions[0];
            const { fileName, repoName } = symbolDefinition;

            navigateToPath({
                repoName,
                revisionName: file.revision,
                path: fileName,
                pathType: 'blob',
                highlightRange: symbolDefinition.range,
            })
        } else {
            navigateToPath({
                repoName,
                revisionName: file.revision,
                path: file.filepath,
                pathType: 'blob',
                setBrowseState: {
                    selectedSymbolInfo: {
                        symbolName,
                        repoName,
                        revisionName: file.revision,
                        language: file.language,
                    },
                    activeExploreMenuTab: "definitions",
                    isBottomPanelCollapsed: false,
                }
            });
        }
    }, [captureEvent, file.filepath, file.language, file.revision, navigateToPath, repoName, domain]);
    
    const onFindReferences = useCallback((symbolName: string) => {
        captureEvent('wa_find_references_pressed', {
            source: 'preview',
        });
        createAuditAction({
            action: "user.performed_find_references",
            metadata: {
                message: symbolName,
            },
        }, domain)

        navigateToPath({
            repoName,
            revisionName: file.revision,
            path: file.filepath,
            pathType: 'blob',
            setBrowseState: {
                selectedSymbolInfo: {
                    repoName,
                    symbolName,
                    revisionName: file.revision,
                    language: file.language,
                },
                activeExploreMenuTab: "references",
                isBottomPanelCollapsed: false,
            }
        })
    }, [captureEvent, file.filepath, file.language, file.revision, navigateToPath, repoName, domain]);

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
                            editorRef={editorRef}
                            language={file.language}
                            revisionName={file.revision}
                            onFindReferences={onFindReferences}
                            onGotoDefinition={onGotoDefinition}
                        />
                    )}
                </CodeMirror>
                <Scrollbar orientation="vertical" />
                <Scrollbar orientation="horizontal" />
            </ScrollArea>
        </div>
    )
}