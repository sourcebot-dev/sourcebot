'use client';

import { ScrollArea } from "@/components/ui/scroll-area";
import { SymbolHoverPopup } from "@/ee/features/codeNav/components/symbolHoverPopup";
import { symbolHoverTargetsExtension } from "@/ee/features/codeNav/components/symbolHoverPopup/symbolHoverTargetsExtension";
import { SymbolDefinition } from "@/ee/features/codeNav/components/symbolHoverPopup/useHoveredOverSymbolInfo";
import { useHasEntitlement } from "@/features/entitlements/useHasEntitlement";
import { useCodeMirrorLanguageExtension } from "@/hooks/useCodeMirrorLanguageExtension";
import { useCodeMirrorTheme } from "@/hooks/useCodeMirrorTheme";
import { useKeymapExtension } from "@/hooks/useKeymapExtension";
import { useNonEmptyQueryParam } from "@/hooks/useNonEmptyQueryParam";
import { search } from "@codemirror/search";
import CodeMirror, { EditorSelection, EditorView, ReactCodeMirrorRef, SelectionRange, ViewUpdate } from "@uiw/react-codemirror";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EditorContextMenu } from "../../../components/editorContextMenu";
import { BrowseHighlightRange, HIGHLIGHT_RANGE_QUERY_PARAM, useBrowseNavigation } from "../../hooks/useBrowseNavigation";
import { useBrowseState } from "../../hooks/useBrowseState";
import { rangeHighlightingExtension } from "./rangeHighlightingExtension";
import useCaptureEvent from "@/hooks/useCaptureEvent";

interface CodePreviewPanelProps {
    path: string;
    repoName: string;
    revisionName: string;
    source: string;
    language: string;
}

export const CodePreviewPanel = ({
    source,
    language,
    path,
    repoName,
    revisionName,
}: CodePreviewPanelProps) => {
    const [editorRef, setEditorRef] = useState<ReactCodeMirrorRef | null>(null);
    const languageExtension = useCodeMirrorLanguageExtension(language, editorRef?.view);
    const [currentSelection, setCurrentSelection] = useState<SelectionRange>();
    const keymapExtension = useKeymapExtension(editorRef?.view);
    const hasCodeNavEntitlement = useHasEntitlement("code-nav");
    const { updateBrowseState } = useBrowseState();
    const { navigateToPath } = useBrowseNavigation();
    const captureEvent = useCaptureEvent();

    const highlightRangeQuery = useNonEmptyQueryParam(HIGHLIGHT_RANGE_QUERY_PARAM);
    const highlightRange = useMemo((): BrowseHighlightRange | undefined => {
        if (!highlightRangeQuery) {
            return;
        }

        // Highlight ranges can be formatted in two ways:
        // 1. start_line,end_line                            (no column specified)
        // 2. start_line:start_column,end_line:end_column    (column specified)
        const rangeRegex = /^(\d+:\d+,\d+:\d+|\d+,\d+)$/;
        if (!rangeRegex.test(highlightRangeQuery)) {
            return;
        }

        const [start, end] = highlightRangeQuery.split(',').map((range) => {
            if (range.includes(':')) {
                return range.split(':').map((val) => parseInt(val, 10));
            }
            // For line-only format, use column 1 for start and last column for end
            const line = parseInt(range, 10);
            return [line];
        });

        if (start.length === 1 || end.length === 1) {
            return {
                start: {
                    lineNumber: start[0],
                },
                end: {
                    lineNumber: end[0],
                }
            }
        } else {
            return {
                start: {
                    lineNumber: start[0],
                    column: start[1],
                },
                end: {
                    lineNumber: end[0],
                    column: end[1],
                }
            }
        }

    }, [highlightRangeQuery]);

    const extensions = useMemo(() => {
        return [
            languageExtension,
            EditorView.lineWrapping,
            keymapExtension,
            search({
                top: true,
            }),
            EditorView.updateListener.of((update: ViewUpdate) => {
                if (update.selectionSet) {
                    setCurrentSelection(update.state.selection.main);
                }
            }),
            highlightRange ? rangeHighlightingExtension(highlightRange) : [],
            hasCodeNavEntitlement ? symbolHoverTargetsExtension : [],
        ];
    }, [
        keymapExtension,
        languageExtension,
        highlightRange,
        hasCodeNavEntitlement,
    ]);

    // Scroll the highlighted range into view.
    useEffect(() => {
        if (!highlightRange || !editorRef || !editorRef.state) {
            return;
        }

        const doc = editorRef.state.doc;
        const { start, end } = highlightRange;
        const selection = EditorSelection.range(
            doc.line(start.lineNumber).from,
            doc.line(end.lineNumber).from,
        );

        editorRef.view?.dispatch({
            effects: [
                EditorView.scrollIntoView(selection, { y: "center" }),
            ]
        });
    }, [editorRef, highlightRange]);

    const onFindReferences = useCallback((symbolName: string) => {
        captureEvent('wa_browse_find_references_pressed', {});

        updateBrowseState({
            selectedSymbolInfo: {
                repoName,
                symbolName,
                revisionName,
                language,
            },
            isBottomPanelCollapsed: false,
            activeExploreMenuTab: "references",
        })
    }, [captureEvent, updateBrowseState, repoName, revisionName, language]);


    // If we resolve multiple matches, instead of navigating to the first match, we should
    // instead popup the bottom sheet with the list of matches.
    const onGotoDefinition = useCallback((symbolName: string, symbolDefinitions: SymbolDefinition[]) => {
        captureEvent('wa_browse_goto_definition_pressed', {});

        if (symbolDefinitions.length === 0) {
            return;
        }

        if (symbolDefinitions.length === 1) {
            const symbolDefinition = symbolDefinitions[0];
            const { fileName, repoName } = symbolDefinition;

            navigateToPath({
                repoName,
                revisionName,
                path: fileName,
                pathType: 'blob',
                highlightRange: symbolDefinition.range,
            })
        } else {
            updateBrowseState({
                selectedSymbolInfo: {
                    symbolName,
                    repoName,
                    revisionName,
                    language,
                },
                activeExploreMenuTab: "definitions",
                isBottomPanelCollapsed: false,
            })
        }
    }, [captureEvent, navigateToPath, revisionName, updateBrowseState, repoName, language]);

    const theme = useCodeMirrorTheme();

    return (
        <ScrollArea className="h-full overflow-auto flex-1">
            <CodeMirror
                className="relative"
                ref={setEditorRef}
                value={source}
                extensions={extensions}
                readOnly={true}
                theme={theme}
            >
                {editorRef && editorRef.view && currentSelection && (
                    <EditorContextMenu
                        view={editorRef.view}
                        selection={currentSelection}
                        repoName={repoName}
                        path={path}
                        revisionName={revisionName}
                    />
                )}
                {editorRef && hasCodeNavEntitlement && (
                    <SymbolHoverPopup
                        editorRef={editorRef}
                        revisionName={revisionName}
                        language={language}
                        onFindReferences={onFindReferences}
                        onGotoDefinition={onGotoDefinition}
                    />
                )}
            </CodeMirror>

        </ScrollArea>
    )
}

