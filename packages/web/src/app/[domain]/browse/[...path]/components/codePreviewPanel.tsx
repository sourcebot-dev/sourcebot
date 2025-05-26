'use client';

import { ScrollArea } from "@/components/ui/scroll-area";
import { useKeymapExtension } from "@/hooks/useKeymapExtension";
import { useNonEmptyQueryParam } from "@/hooks/useNonEmptyQueryParam";
import { useCodeMirrorLanguageExtension } from "@/hooks/useCodeMirrorLanguageExtension";
import { search } from "@codemirror/search";
import CodeMirror, { Decoration, DecorationSet, EditorSelection, EditorView, ReactCodeMirrorRef, SelectionRange, StateField, ViewUpdate } from "@uiw/react-codemirror";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EditorContextMenu } from "../../../components/editorContextMenu";
import { useCodeMirrorTheme } from "@/hooks/useCodeMirrorTheme";
import { symbolHoverTargetsExtension } from "@/ee/features/codeNav/symbolHoverTargetsExtension";
import { SymbolHoverPopup } from "@/ee/features/codeNav/components/symbolHoverPopup";
import { ResizablePanel } from "@/components/ui/resizable";
import { useBrowseState } from "../../useBrowseState";
import { useHasEntitlement } from "@/features/entitlements/useHasEntitlement";
import { SymbolDefinition } from "@/ee/features/codeNav/components/symbolHoverPopup/useHoveredOverSymbolInfo";
import { useRouter, useSearchParams } from "next/navigation";
import { useDomain } from "@/hooks/useDomain";

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
    const searchParams = useSearchParams();
    const router = useRouter();
    const domain = useDomain();
    const { updateBrowseState } = useBrowseState();

    const highlightRangeQuery = useNonEmptyQueryParam('highlightRange');
    const highlightRange = useMemo(() => {
        if (!highlightRangeQuery) {
            return;
        }

        const rangeRegex = /^\d+:\d+,\d+:\d+$/;
        if (!rangeRegex.test(highlightRangeQuery)) {
            return;
        }

        const [start, end] = highlightRangeQuery.split(',').map((range) => {
            return range.split(':').map((val) => parseInt(val, 10));
        });

        return {
            start: {
                line: start[0],
                character: start[1],
            },
            end: {
                line: end[0],
                character: end[1],
            }
        }
    }, [highlightRangeQuery]);

    const extensions = useMemo(() => {
        const highlightDecoration = Decoration.mark({
            class: "searchMatch-selected",
        });

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
            StateField.define<DecorationSet>({
                create(state) {
                    if (!highlightRange) {
                        return Decoration.none;
                    }

                    const { start, end } = highlightRange;
                    const from = state.doc.line(start.line).from + start.character - 1;
                    const to = state.doc.line(end.line).from + end.character - 1;

                    return Decoration.set([
                        highlightDecoration.range(from, to),
                    ]);
                },
                update(deco, tr) {
                    return deco.map(tr.changes);
                },
                provide: (field) => EditorView.decorations.from(field),
            }),
            hasCodeNavEntitlement ? symbolHoverTargetsExtension : [],
        ];
    }, [
        keymapExtension,
        languageExtension,
        highlightRange,
        hasCodeNavEntitlement,
    ]);

    useEffect(() => {
        if (!highlightRange || !editorRef || !editorRef.state) {
            return;
        }

        const doc = editorRef.state.doc;
        const { start, end } = highlightRange;
        const from = doc.line(start.line).from + start.character - 1;
        const to = doc.line(end.line).from + end.character - 1;
        const selection = EditorSelection.range(from, to);

        editorRef.view?.dispatch({
            effects: [
                EditorView.scrollIntoView(selection, { y: "center" }),
            ]
        });
    }, [editorRef, highlightRange]);

    const onFindReferences = useCallback((symbolName: string) => {
        updateBrowseState({
            selectedSymbolInfo: {
                repoName,
                symbolName,
                revisionName,
            },
            isBottomPanelCollapsed: false,
            activeExploreMenuTab: "references",
        })
    }, [updateBrowseState, repoName, revisionName]);


    // If we resolve multiple matches, instead of navigating to the first match, we should
    // instead popup the bottom sheet with the list of matches.
    const onGotoDefinition = useCallback((symbolName: string, symbolDefinitions: SymbolDefinition[]) => {
        if (symbolDefinitions.length === 0) {
            return;
        }

        if (symbolDefinitions.length === 1) {
            const symbolDefinition = symbolDefinitions[0];
            const { fileName, repoName } = symbolDefinition;
            const { start, end } = symbolDefinition.range;
            const highlightRange = `${start.lineNumber}:${start.column},${end.lineNumber}:${end.column}`;

            const params = new URLSearchParams(searchParams.toString());
            params.set('highlightRange', highlightRange);

            router.push(`/${domain}/browse/${repoName}@${revisionName}/-/blob/${fileName}?${params.toString()}`);
        } else {
            updateBrowseState({
                selectedSymbolInfo: {
                    symbolName,
                    repoName,
                    revisionName,
                },
                activeExploreMenuTab: "definitions",
                isBottomPanelCollapsed: false,
            })
        }
    }, [searchParams, router, domain, updateBrowseState, repoName, revisionName]);

    const theme = useCodeMirrorTheme();

    return (
        <ResizablePanel
            order={1}
            id={"code-preview-panel"}
        >
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
                            repoName={repoName}
                            revisionName={revisionName}
                            onFindReferences={onFindReferences}
                            onGotoDefinition={onGotoDefinition}
                        />
                    )}
                </CodeMirror>
                
            </ScrollArea>
        </ResizablePanel>
    )
}

