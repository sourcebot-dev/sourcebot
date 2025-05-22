'use client';

import { ScrollArea } from "@/components/ui/scroll-area";
import { useKeymapExtension } from "@/hooks/useKeymapExtension";
import { useNonEmptyQueryParam } from "@/hooks/useNonEmptyQueryParam";
import { useCodeMirrorLanguageExtension } from "@/hooks/useCodeMirrorLanguageExtension";
import { search } from "@codemirror/search";
import CodeMirror, { Decoration, DecorationSet, EditorSelection, EditorView, ReactCodeMirrorRef, SelectionRange, StateField, ViewUpdate } from "@uiw/react-codemirror";
import { useEffect, useMemo, useState } from "react";
import { EditorContextMenu } from "../../../components/editorContextMenu";
import { useCodeMirrorTheme } from "@/hooks/useCodeMirrorTheme";
import { underlineNodesExtension } from "@/lib/extensions/underlineNodesExtension";
import { SymbolHoverPopup } from "./symbolHoverPopup";
import { ResizablePanel } from "@/components/ui/resizable";

interface CodePreviewPanelProps {
    path: string;
    repoName: string;
    revisionName: string;
    source: string;
    language: string;

    onFindReferences: (symbolName: string) => void;
}

export const CodePreviewPanel = ({
    source,
    language,
    path,
    repoName,
    revisionName,
    onFindReferences,
}: CodePreviewPanelProps) => {
    const [editorRef, setEditorRef] = useState<ReactCodeMirrorRef | null>(null);
    const languageExtension = useCodeMirrorLanguageExtension(language, editorRef?.view);
    const [currentSelection, setCurrentSelection] = useState<SelectionRange>();
    const keymapExtension = useKeymapExtension(editorRef?.view);

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
            class: "cm-searchMatch-selected",
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
            underlineNodesExtension([
                "VariableName",
                "VariableDefinition",
                "TypeDefinition",
                "TypeName",
                "PropertyName",
                "PropertyDefinition",
                "JSXIdentifier",
                "Identifier"
            ]),
        ];
    }, [keymapExtension, languageExtension, highlightRange]);

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

    const theme = useCodeMirrorTheme();

    return (
        <ResizablePanel>
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
                    {editorRef && (
                        <SymbolHoverPopup
                            editorRef={editorRef}
                            repoName={repoName}
                            onFindReferences={onFindReferences}
                        />
                    )}
                </CodeMirror>
                
            </ScrollArea>
        </ResizablePanel>
    )
}

