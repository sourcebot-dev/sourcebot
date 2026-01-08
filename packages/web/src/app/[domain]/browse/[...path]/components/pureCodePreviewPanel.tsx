'use client';

import { ScrollArea } from "@/components/ui/scroll-area";
import { SymbolHoverPopup } from "@/ee/features/codeNav/components/symbolHoverPopup";
import { symbolHoverTargetsExtension } from "@/ee/features/codeNav/components/symbolHoverPopup/symbolHoverTargetsExtension";
import { useHasEntitlement } from "@/features/entitlements/useHasEntitlement";
import { useCodeMirrorLanguageExtension } from "@/hooks/useCodeMirrorLanguageExtension";
import { useCodeMirrorTheme } from "@/hooks/useCodeMirrorTheme";
import { useKeymapExtension } from "@/hooks/useKeymapExtension";
import { useNonEmptyQueryParam } from "@/hooks/useNonEmptyQueryParam";
import { search } from "@codemirror/search";
import CodeMirror, { EditorSelection, EditorView, ReactCodeMirrorRef, SelectionRange, ViewUpdate } from "@uiw/react-codemirror";
import { useEffect, useMemo, useState } from "react";
import { EditorContextMenu } from "../../../components/editorContextMenu";
import { BrowseHighlightRange, HIGHLIGHT_RANGE_QUERY_PARAM } from "../../hooks/utils";
import { rangeHighlightingExtension } from "./rangeHighlightingExtension";

interface PureCodePreviewPanelProps {
    path: string;
    repoName: string;
    revisionName: string;
    source: string;
    language: string;
}

export const PureCodePreviewPanel = ({
    source,
    language,
    path,
    repoName,
    revisionName,
}: PureCodePreviewPanelProps) => {
    const [editorRef, setEditorRef] = useState<ReactCodeMirrorRef | null>(null);
    const languageExtension = useCodeMirrorLanguageExtension(language, editorRef?.view);
    const [currentSelection, setCurrentSelection] = useState<SelectionRange>();
    const keymapExtension = useKeymapExtension(editorRef?.view);
    const hasCodeNavEntitlement = useHasEntitlement("code-nav");

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
        if (!highlightRange || !editorRef || !editorRef.state || !editorRef.view) {
            return;
        }

        const doc = editorRef.state.doc;
        const { start, end } = highlightRange;

        const from = doc.line(start.lineNumber).from;
        const to = doc.line(end.lineNumber).to;
        const selection = EditorSelection.range(from, to);

        // When the selection is in view, we don't want to perform any scrolling
        // as it could be jarring for the user. If it is not in view, scroll to the
        // center of the viewport.
        const viewport = editorRef.view.viewport;
        const isInView = from >= viewport.from && to <= viewport.to;
        const scrollStrategy = isInView ? "nearest" : "center";
        
        editorRef.view?.dispatch({
            effects: [
                EditorView.scrollIntoView(selection, { y: scrollStrategy }),
            ]
        });
    }, [editorRef, highlightRange]);

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
                        source="preview"
                        editorRef={editorRef}
                        revisionName={revisionName}
                        language={language}
                        fileName={path}
                        repoName={repoName}
                    />
                )}
            </CodeMirror>

        </ScrollArea>
    )
}

