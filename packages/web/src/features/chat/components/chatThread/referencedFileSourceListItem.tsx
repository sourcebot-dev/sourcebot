'use client';

import { PathHeader } from "@/app/[domain]/components/pathHeader";
import { SymbolHoverPopup } from '@/ee/features/codeNav/components/symbolHoverPopup';
import { symbolHoverTargetsExtension } from "@/ee/features/codeNav/components/symbolHoverPopup/symbolHoverTargetsExtension";
import { useHasEntitlement } from "@/features/entitlements/useHasEntitlement";
import { useCodeMirrorLanguageExtension } from "@/hooks/useCodeMirrorLanguageExtension";
import { useCodeMirrorTheme } from "@/hooks/useCodeMirrorTheme";
import { useKeymapExtension } from "@/hooks/useKeymapExtension";
import { cn } from "@/lib/utils";
import { Range } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from '@codemirror/view';
import { CodeHostType } from "@sourcebot/db";
import CodeMirror, { ReactCodeMirrorRef, StateField } from '@uiw/react-codemirror';
import isEqual from "fast-deep-equal/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { forwardRef, memo, Ref, useCallback, useImperativeHandle, useMemo, useState } from "react";
import { FileReference } from "../../types";
import { createCodeFoldingExtension } from "./codeFoldingExtension";

const lineDecoration = Decoration.line({
    attributes: { class: "cm-range-border-radius chat-lineHighlight" },
});

const selectedLineDecoration = Decoration.line({
    attributes: { class: "cm-range-border-radius cm-range-border-shadow chat-lineHighlight-selected" },
});

const hoverLineDecoration = Decoration.line({
    attributes: { class: "chat-lineHighlight-hover" },
});


interface ReferencedFileSourceListItemProps {
    id: string;
    code: string;
    language: string;
    revision: string;
    repoName: string;
    repoCodeHostType: CodeHostType;
    repoDisplayName?: string;
    repoWebUrl?: string;
    fileName: string;
    references: FileReference[];
    selectedReference?: FileReference;
    hoveredReference?: FileReference;
    onSelectedReferenceChanged: (reference?: FileReference) => void;
    onHoveredReferenceChanged: (reference?: FileReference) => void;
    isExpanded: boolean;
    onExpandedChanged: (isExpanded: boolean) => void;
}

const ReferencedFileSourceListItem = ({
    id,
    code,
    language,
    revision,
    repoName,
    repoCodeHostType,
    repoDisplayName,
    repoWebUrl,
    fileName,
    references,
    selectedReference,
    hoveredReference,
    onSelectedReferenceChanged,
    onHoveredReferenceChanged,
    isExpanded,
    onExpandedChanged,
}: ReferencedFileSourceListItemProps, forwardedRef: Ref<ReactCodeMirrorRef>) => {
    const theme = useCodeMirrorTheme();
    const [editorRef, setEditorRef] = useState<ReactCodeMirrorRef | null>(null);

    useImperativeHandle(
        forwardedRef,
        () => editorRef as ReactCodeMirrorRef
    );
    const keymapExtension = useKeymapExtension(editorRef?.view);
    const hasCodeNavEntitlement = useHasEntitlement("code-nav");

    const languageExtension = useCodeMirrorLanguageExtension(language, editorRef?.view);

    const getReferenceAtPos = useCallback((x: number, y: number, view: EditorView): FileReference | undefined => {
        const pos = view.posAtCoords({ x, y });
        if (pos === null) return undefined;

        // Check if position is within the main editor content area
        const rect = view.contentDOM.getBoundingClientRect();
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            return undefined;
        }

        const line = view.state.doc.lineAt(pos);
        const lineNumber = line.number;

        // Check if this line is part of any highlighted range
        const matchingRanges = references.filter(({ range }) =>
            range && lineNumber >= range.startLine && lineNumber <= range.endLine
        );

        // Sort by the length of the range.
        // Shorter ranges are more specific, so we want to prioritize them.
        matchingRanges.sort((a, b) => {
            const aLength = (a.range!.endLine) - (a.range!.startLine);
            const bLength = (b.range!.endLine) - (b.range!.startLine);
            return aLength - bLength;
        });

        if (matchingRanges.length > 0) {
            return matchingRanges[0];
        }

        return undefined;
    }, [references]);

    const codeFoldingExtension = useMemo(() => {
        return createCodeFoldingExtension(references, 3);
    }, [references]);

    const extensions = useMemo(() => {
        return [
            languageExtension,
            EditorView.lineWrapping,
            keymapExtension,
            ...(hasCodeNavEntitlement ? [
                symbolHoverTargetsExtension,
            ] : []),
            codeFoldingExtension,
            StateField.define<DecorationSet>({
                create(state) {
                    const decorations: Range<Decoration>[] = [];

                    for (const { range, id } of references) {
                        if (!range) {
                            continue;
                        }

                        const isHovered = id === hoveredReference?.id;
                        const isSelected = id === selectedReference?.id;

                        for (let line = range.startLine; line <= range.endLine; line++) {
                            // Skip lines that are outside the document bounds.
                            if (line > state.doc.lines) {
                                continue;
                            }

                            if (isSelected) {
                                decorations.push(selectedLineDecoration.range(state.doc.line(line).from));
                            } else {
                                decorations.push(lineDecoration.range(state.doc.line(line).from));
                                if (isHovered) {
                                    decorations.push(hoverLineDecoration.range(state.doc.line(line).from));
                                }
                            }

                        }
                    }

                    return Decoration.set(decorations, /* sort = */ true);
                },
                update(deco, tr) {
                    return deco.map(tr.changes);
                },
                provide: (field) => EditorView.decorations.from(field),
            }),
            EditorView.domEventHandlers({
                click: (event, view) => {
                    const reference = getReferenceAtPos(event.clientX, event.clientY, view);

                    if (reference) {
                        onSelectedReferenceChanged(reference.id === selectedReference?.id ? undefined : reference);
                        return true; // prevent default handling
                    }
                    return false;
                },
                mouseover: (event, view) => {
                    const reference = getReferenceAtPos(event.clientX, event.clientY, view);
                    if (!reference) {
                        return false;
                    }

                    if (reference.id === selectedReference?.id || reference.id === hoveredReference?.id) {
                        return false;
                    }

                    onHoveredReferenceChanged(reference);
                    return true;
                },
                mouseout: (event, view) => {
                    const reference = getReferenceAtPos(event.clientX, event.clientY, view);
                    if (reference) {
                        return false;
                    }

                    onHoveredReferenceChanged(undefined);
                    return true;
                }
            })
        ];
    }, [
        languageExtension,
        keymapExtension,
        hasCodeNavEntitlement,
        references,
        hoveredReference?.id,
        selectedReference?.id,
        getReferenceAtPos,
        onSelectedReferenceChanged,
        onHoveredReferenceChanged,
        codeFoldingExtension,
    ]);

    const ExpandCollapseIcon = useMemo(() => {
        return isExpanded ? ChevronDown : ChevronRight;
    }, [isExpanded]);

    return (
        <div className="relative" id={id}>
            {/* Sentinel element to scroll to when collapsing a file */}
            <div id={`${id}-start`} />
            {/* Sticky header outside the bordered container */}
            <div className={cn("sticky top-0 z-10 flex flex-row items-center bg-accent py-1 px-3 gap-1.5 border-l border-r border-t rounded-t-md", {
                'rounded-b-md border-b': !isExpanded,
            })}>
                <ExpandCollapseIcon className={`h-3 w-3 cursor-pointer mt-0.5`} onClick={() => onExpandedChanged(!isExpanded)} />
                <PathHeader
                    path={fileName}
                    repo={{
                        name: repoName,
                        codeHostType: repoCodeHostType,
                        displayName: repoDisplayName,
                        webUrl: repoWebUrl,
                    }}
                    branchDisplayName={revision === 'HEAD' ? undefined : revision}
                    repoNameClassName="font-normal text-muted-foreground text-sm"
                />
            </div>

            {/* Code container */}
            {/* @note: don't conditionally render here since we want to maintain state */}
            <div className="border-l border-r border-b rounded-b-md overflow-hidden" style={{
                height: isExpanded ? 'auto' : '0px',
                visibility: isExpanded ? 'visible' : 'hidden',
            }}>
                <CodeMirror
                    ref={setEditorRef}
                    value={code}
                    extensions={extensions}
                    readOnly={true}
                    theme={theme}
                    basicSetup={{
                        highlightActiveLine: false,
                        highlightActiveLineGutter: false,
                        foldGutter: false,
                        foldKeymap: false,
                    }}
                >
                    {editorRef && hasCodeNavEntitlement && (
                        <SymbolHoverPopup
                            source="chat"
                            editorRef={editorRef}
                            revisionName={revision}
                            language={language}
                            repoName={repoName}
                            fileName={fileName}
                        />
                    )}
                </CodeMirror>
            </div>
        </div>
    )
}

export default memo(forwardRef(ReferencedFileSourceListItem), isEqual) as (
    props: ReferencedFileSourceListItemProps & { ref?: Ref<ReactCodeMirrorRef> },
) => ReturnType<typeof ReferencedFileSourceListItem>;
