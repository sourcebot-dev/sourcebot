'use client';

import { ScrollArea } from "@/components/ui/scroll-area";
import { useKeymapExtension } from "@/hooks/useKeymapExtension";
import { useNonEmptyQueryParam } from "@/hooks/useNonEmptyQueryParam";
import { useSyntaxHighlightingExtension } from "@/hooks/useSyntaxHighlightingExtension";
import { search } from "@codemirror/search";
import CodeMirror, { Decoration, DecorationSet, EditorSelection, EditorView, ReactCodeMirrorRef, SelectionRange, StateField, ViewUpdate } from "@uiw/react-codemirror";
import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContextMenu } from "../../components/editorContextMenu";
import { useCodeMirrorTheme } from "@/hooks/useCodeMirrorTheme";

interface CodePreviewProps {
    path: string;
    repoName: string;
    revisionName: string;
    source: string;
    language: string;
}

export const CodePreview = ({
    source,
    language,
    path,
    repoName,
    revisionName,
}: CodePreviewProps) => {
    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const syntaxHighlighting = useSyntaxHighlightingExtension(language, editorRef.current?.view);
    const [currentSelection, setCurrentSelection] = useState<SelectionRange>();
    const keymapExtension = useKeymapExtension(editorRef.current?.view);
    const [isEditorCreated, setIsEditorCreated] = useState(false);

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
            syntaxHighlighting,
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
        ];
    }, [keymapExtension, syntaxHighlighting, highlightRange]);

    useEffect(() => {
        if (!highlightRange || !editorRef.current || !editorRef.current.state) {
            return;
        }

        const doc = editorRef.current.state.doc;
        const { start, end } = highlightRange;
        const from = doc.line(start.line).from + start.character - 1;
        const to = doc.line(end.line).from + end.character - 1;
        const selection = EditorSelection.range(from, to);

        editorRef.current.view?.dispatch({
            effects: [
                EditorView.scrollIntoView(selection, { y: "center" }),
            ]
        });
        // @note: we need to include `isEditorCreated` in the dependency array since
        // a race-condition can happen if the `highlightRange` is resolved before the
        // editor is created.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [highlightRange, isEditorCreated]);

    const theme = useCodeMirrorTheme();

    return (
        <ScrollArea className="h-full overflow-auto flex-1">
            <CodeMirror
                className="relative"
                ref={editorRef}
                onCreateEditor={() => {
                    setIsEditorCreated(true);
                }}
                value={source}
                extensions={extensions}
                readOnly={true}
                theme={theme}
            >
                {editorRef.current && editorRef.current.view && currentSelection && (
                    <EditorContextMenu
                        view={editorRef.current.view}
                        selection={currentSelection}
                        repoName={repoName}
                        path={path}
                        revisionName={revisionName}
                    />
                )}
            </CodeMirror>
        </ScrollArea>
    )
}

