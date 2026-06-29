'use client';

import { VscodeFileIcon } from "@/app/components/vscodeFileIcon";
import { useCodeMirrorLanguageExtension } from "@/hooks/useCodeMirrorLanguageExtension";
import { useCodeMirrorTheme } from "@/hooks/useCodeMirrorTheme";
import { useExtensionWithDependency } from "@/hooks/useExtensionWithDependency";
import { useKeymapExtension } from "@/hooks/useKeymapExtension";
import { getLinguistLanguageForFilename } from "@/features/chat/attachments/language";
import { cn } from "@/lib/utils";
import { EditorView } from '@codemirror/view';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import isEqual from "fast-deep-equal/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { forwardRef, memo, Ref, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { Reference } from "@/features/chat/types";
import { createCodeFoldingExtension } from "./codeFoldingExtension";
import { createReferencesHighlightExtension, setHoveredIdEffect, setSelectedIdEffect } from "./referencesHighlightExtension";

const CODEMIRROR_BASIC_SETUP = {
    highlightActiveLine: false,
    highlightActiveLineGutter: false,
    foldGutter: false,
    foldKeymap: false,
} as const;

interface ReferencedAttachmentListItemProps {
    id: string;
    code: string;
    filename: string;
    references: Reference[];
    selectedReference?: Reference;
    hoveredReference?: Reference;
    onSelectedReferenceChanged: (reference?: Reference) => void;
    onHoveredReferenceChanged: (reference?: Reference) => void;
    isExpanded: boolean;
    onExpandedChanged: (isExpanded: boolean) => void;
}

// Renders a cited attachment as evidence: the same line-highlighted CodeMirror
// view used for file references, but provenance-distinct (an "Uploaded" label,
// no repository header, no code-host link, no code-nav) so the user can always
// tell their own uploads from indexed code. Content is inline, so no fetch.
const ReferencedAttachmentListItemComponent = ({
    id,
    code,
    filename,
    references,
    selectedReference,
    hoveredReference,
    onSelectedReferenceChanged,
    onHoveredReferenceChanged,
    isExpanded,
    onExpandedChanged,
}: ReferencedAttachmentListItemProps, forwardedRef: Ref<ReactCodeMirrorRef>) => {
    const theme = useCodeMirrorTheme();
    const [editorRef, setEditorRef] = useState<ReactCodeMirrorRef | null>(null);

    useImperativeHandle(
        forwardedRef,
        () => editorRef as ReactCodeMirrorRef
    );

    const keymapExtension = useKeymapExtension(editorRef?.view);
    const language = useMemo(() => getLinguistLanguageForFilename(filename), [filename]);
    const languageExtension = useCodeMirrorLanguageExtension(language, editorRef?.view);

    const codeFoldingExtension = useMemo(() => {
        return createCodeFoldingExtension(references, 3);
    }, [references]);

    const referencesHighlightExtension = useExtensionWithDependency(
        editorRef?.view ?? null,
        () => createReferencesHighlightExtension(references, onHoveredReferenceChanged, onSelectedReferenceChanged),
        [references],
    );

    useEffect(() => {
        if (editorRef?.view) {
            editorRef.view.dispatch({ effects: setHoveredIdEffect.of(hoveredReference?.id) });
        }
    }, [hoveredReference?.id, editorRef?.view]);

    useEffect(() => {
        if (editorRef?.view) {
            editorRef.view.dispatch({ effects: setSelectedIdEffect.of(selectedReference?.id) });
        }
    }, [selectedReference?.id, editorRef?.view]);

    const extensions = useMemo(() => {
        return [
            languageExtension,
            EditorView.lineWrapping,
            keymapExtension,
            codeFoldingExtension,
            referencesHighlightExtension,
        ];
    }, [
        languageExtension,
        keymapExtension,
        codeFoldingExtension,
        referencesHighlightExtension,
    ]);

    const ExpandCollapseIcon = useMemo(() => {
        return isExpanded ? ChevronDown : ChevronRight;
    }, [isExpanded]);

    const isSelectedWithoutRange = useMemo(() => {
        return references.some(r => r.id === selectedReference?.id && !selectedReference?.range);
    }, [references, selectedReference?.id, selectedReference?.range]);

    return (
        <div className="relative rounded-md overflow-clip" id={id}>
            {/* Sentinel element to scroll to when collapsing an attachment */}
            <div id={`${id}-start`} />
            {/* Sticky header outside the bordered container */}
            <div className={cn("sticky top-0 z-10 flex flex-row items-center bg-accent py-1 px-3 gap-1.5 border-l border-r border-t", {
                'border-b': !isExpanded,
                'border-chat-reference-selected-border border-b': isSelectedWithoutRange,
            })}>
                <ExpandCollapseIcon className={`h-3 w-3 cursor-pointer mt-0.5`} onClick={() => onExpandedChanged(!isExpanded)} />
                <VscodeFileIcon fileName={filename} className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="font-medium text-sm truncate">{filename}</span>
                <span className="text-xs text-muted-foreground rounded bg-muted px-1.5 py-0.5">Uploaded</span>
            </div>

            {/* Code container */}
            {/* @note: don't conditionally render here since we want to maintain state */}
            <div className="border-l border-r border-b overflow-hidden" style={{
                height: isExpanded ? 'auto' : '0px',
                visibility: isExpanded ? 'visible' : 'hidden',
            }}>
                <CodeMirror
                    ref={setEditorRef}
                    value={code}
                    extensions={extensions}
                    readOnly={true}
                    theme={theme}
                    basicSetup={CODEMIRROR_BASIC_SETUP}
                />
            </div>
        </div>
    )
}

export const ReferencedAttachmentListItem = memo(forwardRef(ReferencedAttachmentListItemComponent), isEqual) as (
    props: ReferencedAttachmentListItemProps & { ref?: Ref<ReactCodeMirrorRef> },
) => ReturnType<typeof ReferencedAttachmentListItemComponent>;
