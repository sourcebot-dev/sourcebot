'use client';

import { PathHeader } from "@/app/[domain]/components/pathHeader";
import { SymbolHoverPopup } from '@/ee/features/codeNav/components/symbolHoverPopup';
import { symbolHoverTargetsExtension } from "@/ee/features/codeNav/components/symbolHoverPopup/symbolHoverTargetsExtension";
import { useHasEntitlement } from "@/features/entitlements/useHasEntitlement";
import { useCodeMirrorLanguageExtension } from "@/hooks/useCodeMirrorLanguageExtension";
import { useCodeMirrorTheme } from "@/hooks/useCodeMirrorTheme";
import { useExtensionWithDependency } from "@/hooks/useExtensionWithDependency";
import { useKeymapExtension } from "@/hooks/useKeymapExtension";
import { cn } from "@/lib/utils";
import { EditorView } from '@codemirror/view';
import { CodeHostType } from "@sourcebot/db";
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import isEqual from "fast-deep-equal/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { forwardRef, memo, Ref, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { FileReference } from "../../types";
import { createCodeFoldingExtension } from "./codeFoldingExtension";
import { createReferencesHighlightExtension, setHoveredIdEffect, setSelectedIdEffect } from "./referencesHighlightExtension";

const CODEMIRROR_BASIC_SETUP = {
    highlightActiveLine: false,
    highlightActiveLineGutter: false,
    foldGutter: false,
    foldKeymap: false,
} as const;

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

const ReferencedFileSourceListItemComponent = ({
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
            ...(hasCodeNavEntitlement ? [
                symbolHoverTargetsExtension,
            ] : []),
            codeFoldingExtension,
            referencesHighlightExtension,
        ];
    }, [
        languageExtension,
        keymapExtension,
        hasCodeNavEntitlement,
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
        <div className="relative" id={id}>
            {/* Sentinel element to scroll to when collapsing a file */}
            <div id={`${id}-start`} />
            {/* Sticky header outside the bordered container */}
            <div className={cn("sticky top-0 z-10 flex flex-row items-center bg-accent py-1 px-3 gap-1.5 border-l border-r border-t rounded-t-md", {
                'rounded-b-md border-b': !isExpanded,
                'border-chat-reference-selected-border border-b': isSelectedWithoutRange,
            })}>
                <ExpandCollapseIcon className={`h-3 w-3 cursor-pointer mt-0.5`} onClick={() => onExpandedChanged(!isExpanded)} />
                <PathHeader
                    path={fileName}
                    repo={{
                        name: repoName,
                        codeHostType: repoCodeHostType,
                        displayName: repoDisplayName,
                        externalWebUrl: repoWebUrl,
                    }}
                    revisionName={revision === 'HEAD' ? undefined : revision}
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
                    basicSetup={CODEMIRROR_BASIC_SETUP}
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

export const ReferencedFileSourceListItem = memo(forwardRef(ReferencedFileSourceListItemComponent), isEqual) as (
    props: ReferencedFileSourceListItemProps & { ref?: Ref<ReactCodeMirrorRef> },
) => ReturnType<typeof ReferencedFileSourceListItemComponent>;
