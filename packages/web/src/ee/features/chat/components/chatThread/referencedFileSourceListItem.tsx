'use client';

import { PathHeader } from "@/app/(app)/components/pathHeader";
import { SymbolHoverPopup } from '@/ee/features/codeNav/components/symbolHoverPopup';
import { symbolHoverTargetsExtension } from "@/ee/features/codeNav/components/symbolHoverPopup/symbolHoverTargetsExtension";
import { useHasEntitlement } from "@/features/entitlements/useHasEntitlement";
import { useCodeMirrorLanguageExtension } from "@/hooks/useCodeMirrorLanguageExtension";
import { useCodeMirrorTheme } from "@/hooks/useCodeMirrorTheme";
import { useExtensionWithDependency } from "@/hooks/useExtensionWithDependency";
import { useKeymapExtension } from "@/hooks/useKeymapExtension";
import { cn, truncateSha } from "@/lib/utils";
import { getBrowsePath } from "@/app/(app)/browse/hooks/utils";
import { EditorView } from '@codemirror/view';
import { CodeHostType } from "@sourcebot/db";
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import isEqual from "fast-deep-equal/react";
import { ChevronDown, ChevronRight, History } from "lucide-react";
import Link from "next/link";
import { forwardRef, memo, Ref, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { FileReference } from "@/features/chat/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { createCodeFoldingExtension } from "./codeFoldingExtension";
import { createReferencesHighlightExtension, setHoveredIdEffect, setSelectedIdEffect } from "./referencesHighlightExtension";

export type FileFreshnessStatus = 'fresh' | 'changed' | 'removed' | 'pinned_unavailable';

const FreshnessBadge = ({
    status,
    pinnedSha,
    currentSha,
    repoName,
    path,
}: {
    status: FileFreshnessStatus;
    pinnedSha?: string;
    currentSha?: string;
    repoName: string;
    path: string;
}) => {
    if (status === 'fresh') {
        return null;
    }

    const shortPinned = pinnedSha ? truncateSha(pinnedSha) : undefined;

    const { label, tooltip, className } = (() => {
        switch (status) {
            case 'changed':
                return {
                    label: 'Changed since',
                    tooltip: `Shown as of ${shortPinned ?? 'the cited commit'}. This file has changed since this answer was generated.`,
                    className: 'text-amber-600 dark:text-amber-500',
                };
            case 'removed':
                return {
                    label: 'Removed since',
                    tooltip: `Shown as of ${shortPinned ?? 'the cited commit'}. This file no longer exists at the latest revision.`,
                    className: 'text-destructive',
                };
            case 'pinned_unavailable':
                return {
                    label: 'Showing latest',
                    tooltip: `The cited commit ${shortPinned ? `(${shortPinned}) ` : ''}is no longer available, so the latest version is shown.`,
                    className: 'text-muted-foreground',
                };
        }
    })();

    return (
        <div className="flex shrink-0 items-center gap-1.5">
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className={cn('flex items-center gap-1 text-xs font-medium', className)}>
                        <History className="h-3 w-3" />
                        {label}
                    </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                    {tooltip}
                </TooltipContent>
            </Tooltip>
            {status === 'changed' && currentSha && (
                <Link
                    href={getBrowsePath({
                        repoName,
                        revisionName: currentSha,
                        path,
                        pathType: 'blob',
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground underline hover:text-foreground"
                >
                    View latest
                </Link>
            )}
        </div>
    );
};

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
    // The pinned commit the file content is shown at (short-displayed in the
    // staleness hint). Undefined for un-pinned (pre-pinning) sources.
    pinnedSha?: string;
    // Result of comparing the pinned commit against the current tip. Undefined
    // while loading or for un-pinned sources.
    freshnessStatus?: FileFreshnessStatus;
    // The current default-branch commit, used to link to the latest version.
    currentSha?: string;
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
    pinnedSha,
    freshnessStatus,
    currentSha,
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
        <div className="relative rounded-md overflow-clip" id={id}>
            {/* Sentinel element to scroll to when collapsing a file */}
            <div id={`${id}-start`} />
            {/* Sticky header outside the bordered container */}
            <div className={cn("sticky top-0 z-10 flex flex-row items-center bg-accent py-1 px-3 gap-1.5 border-l border-r border-t", {
                'border-b': !isExpanded,
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
                {freshnessStatus && (
                    <FreshnessBadge
                        status={freshnessStatus}
                        pinnedSha={pinnedSha}
                        currentSha={currentSha}
                        repoName={repoName}
                        path={fileName}
                    />
                )}
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
