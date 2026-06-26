'use client';

import { ScrollArea } from "@/components/ui/scroll-area";
import { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import scrollIntoView from 'scroll-into-view-if-needed';
import { FileReference, FileSource } from "@/features/chat/types";
import { tryResolveFileReference } from '@/features/chat/utils';
import { ReferencedFileSourceListItemContainer } from "./referencedFileSourceListItemContainer";
import { DiagramPanelListItem } from "./diagramPanelListItem";
import { PanelItem } from "@/ee/features/chat/useExtractPanelItems";
import { PanelSelection, usePanelContext } from "@/ee/features/chat/panelContext";
import isEqual from 'fast-deep-equal/react';

interface ReferencedSourcesListViewProps {
    references: FileReference[];
    sources: FileSource[];
    index: number;
    style: React.CSSProperties;
    orderedItems?: PanelItem[];
    selected?: PanelSelection;
    hovered?: PanelSelection;
}

const ReferencedSourcesListViewComponent = ({
    references,
    sources,
    index,
    style,
    orderedItems = [],
    selected,
    hovered,
}: ReferencedSourcesListViewProps) => {
    const panel = usePanelContext();
    const noop = useCallback(() => {}, []);
    // Reference selection/hover is driven through the unified panel context; the
    // file source items still call these the same way (e.g. from the CodeMirror
    // reference-highlight extension).
    const onSelectedReferenceChanged = panel?.setSelectedReference ?? noop;
    const onHoveredReferenceChanged = panel?.setHoveredReference ?? noop;

    const selectedReference = selected?.kind === 'reference' ? selected.reference : undefined;
    const hoveredReference = hovered?.kind === 'reference' ? hovered.reference : undefined;
    const selectedDiagramId = selected?.kind === 'diagram' ? selected.diagramId : undefined;
    const hoveredDiagramId = hovered?.kind === 'diagram' ? hovered.diagramId : undefined;

    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const editorRefsMap = useRef<Map<string, ReactCodeMirrorRef>>(new Map());
    const [collapsedFileIds, setCollapsedFileIds] = useState<string[]>([]);
    // Diagrams render expanded by default (the panel is the canonical view);
    // track the ids the user has explicitly collapsed, mirroring collapsedFileIds.
    const [collapsedDiagramIds, setCollapsedDiagramIds] = useState<string[]>([]);
    // Transient highlight applied when a diagram is revealed from the answer.
    const [highlightedDiagramId, setHighlightedDiagramId] = useState<string | undefined>(undefined);

    // When a diagram is revealed from the answer, ensure it is expanded, scroll
    // it into view, and briefly highlight it.
    useEffect(() => {
        if (!selectedDiagramId) {
            return;
        }
        setCollapsedDiagramIds((prev) => prev.filter((id) => id !== selectedDiagramId));
        const element = document.getElementById(`diagram-panel-${selectedDiagramId}`);
        if (element) {
            scrollIntoView(element, { scrollMode: 'if-needed', block: 'center', behavior: 'smooth' });
        }
        setHighlightedDiagramId(selectedDiagramId);
        const timeout = window.setTimeout(() => setHighlightedDiagramId(undefined), 2000);
        return () => window.clearTimeout(timeout);
    }, [selectedDiagramId]);

    const onToggleDiagram = useCallback((diagramId: string) => {
        setCollapsedDiagramIds((prev) => (
            prev.includes(diagramId) ? prev.filter((id) => id !== diagramId) : [...prev, diagramId]
        ));
    }, []);

    const getFileId = useCallback((fileSource: FileSource) => {
        // @note: we include the index to ensure that the file id is unique
        // across other ReferencedSourcesListView components in the
        // same thread.
        return `file-source-${fileSource.repo}-${fileSource.path}-${index}`;
    }, [index]);

    const setEditorRef = useCallback((fileKey: string, ref: ReactCodeMirrorRef | null) => {
        if (ref) {
            editorRefsMap.current.set(fileKey, ref);
        } else {
            editorRefsMap.current.delete(fileKey);
        }
    }, []);

    // Memoize the computation of references grouped by file source
    const referencesGroupedByFile = useMemo(() => {
        const groupedReferences = new Map<string, FileReference[]>();

        for (const fileSource of sources) {
            const fileKey = getFileId(fileSource);
            const referencesInFile = references.filter((reference) => {
                if (reference.type !== 'file') {
                    return false;
                }
                return tryResolveFileReference(reference, [fileSource]) !== undefined;
            });
            groupedReferences.set(fileKey, referencesInFile);
        }

        return groupedReferences;
    }, [references, sources, getFileId]);

    useEffect(() => {
        if (!selectedReference || selectedReference.type !== 'file') {
            return;
        }

        const fileSource = tryResolveFileReference(selectedReference, sources);
        if (!fileSource) {
            return;
        }

        const fileId = getFileId(fileSource);

        const fileSourceElement = document.getElementById(fileId);

        if (!fileSourceElement) {
            return;
        }

        const editorRef = editorRefsMap.current.get(fileId);
        const scrollAreaViewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;

        // If we have a range, we can scroll to the starting line number.
        if (
            selectedReference.range &&
            editorRef &&
            editorRef.view &&
            scrollAreaViewport &&
            selectedReference.range.startLine <= editorRef.view.state.doc.lines
        ) {
            // Expand the file if it's collapsed.
            setCollapsedFileIds((collapsedFileIds) => collapsedFileIds.filter((id) => id !== fileId));

            // @hack: CodeMirror 6 virtualizes line rendering — it only renders lines near the
            // browser viewport and uses estimated heights for everything else. This means
            // coordsAtPos() returns inaccurate positions for lines that are off-screen,
            // causing the scroll to land at the wrong position on the first click.
            //
            // To work around this, we use a two-step scroll:
            //   Step 1: Instantly bring the file element into the browser viewport. This
            //           forces CodeMirror to render and measure the target lines.
            //   Step 2: In the next frame (after CodeMirror has measured), coordsAtPos()
            //           returns accurate screen coordinates which we use to scroll precisely
            //           to the target line.
            scrollIntoView(fileSourceElement, {
                scrollMode: 'if-needed',
                block: 'start',
                behavior: 'instant',
            });

            const view = editorRef.view;
            const lineNumber = selectedReference.range.startLine;

            requestAnimationFrame(() => {
                // Get the line's position within the CodeMirror document
                const pos = view.state.doc.line(lineNumber).from;
                const blockInfo = view.lineBlockAt(pos);
                const lineTopInCodeMirror = blockInfo.top;

                // Get the bounds of both elements
                const viewportRect = scrollAreaViewport.getBoundingClientRect();
                const codeMirrorRect = view.dom.getBoundingClientRect();

                // Calculate the line's position relative to the ScrollArea content
                const lineTopRelativeToScrollArea = lineTopInCodeMirror + (codeMirrorRect.top - viewportRect.top) + scrollAreaViewport.scrollTop;

                // Get the height of the visible ScrollArea
                const scrollAreaHeight = scrollAreaViewport.clientHeight;

                // Calculate the target scroll position to center the line
                const targetScrollTop = lineTopRelativeToScrollArea - (scrollAreaHeight / 3);

                scrollAreaViewport.scrollTo({
                    top: Math.max(0, targetScrollTop),
                    behavior: 'instant',
                });
            });
        }

        // Otherwise, fallback to scrolling to the top of the file.
        else {
            scrollIntoView(fileSourceElement, {
                scrollMode: 'if-needed',
                block: 'start',
                behavior: 'instant',
            });
        }
    }, [getFileId, sources, selectedReference]);

    const onExpandedChanged = useCallback((fileId: string, isExpanded: boolean) => {
        if (isExpanded) {
            setCollapsedFileIds(collapsedFileIds => collapsedFileIds.filter((id) => id !== fileId));
        } else {
            setCollapsedFileIds(collapsedFileIds => [...collapsedFileIds, fileId]);
        }

        if (!isExpanded) {
            const fileSourceStart = document.getElementById(`${fileId}-start`);
            if (fileSourceStart) {
                scrollIntoView(fileSourceStart, {
                    scrollMode: 'if-needed',
                    block: 'start',
                    behavior: 'instant',
                });
            }
        }
    }, []);

    if (orderedItems.length === 0) {
        return (
            <div className="p-4 text-center text-muted-foreground text-sm">
                No references found
            </div>
        );
    }

    return (
        <ScrollArea
            ref={scrollAreaRef}
            style={style}
        >
            <div className="space-y-4 px-2 py-1">
                {orderedItems.map((item) => {
                    if (item.kind === 'diagram') {
                        return (
                            <DiagramPanelListItem
                                key={`diagram-${item.diagram.id}`}
                                diagram={item.diagram}
                                index={item.diagramIndex}
                                isExpanded={!collapsedDiagramIds.includes(item.diagram.id)}
                                isHighlighted={highlightedDiagramId === item.diagram.id}
                                isHovered={hoveredDiagramId === item.diagram.id}
                                onToggle={() => onToggleDiagram(item.diagram.id)}
                                onJumpToInline={() => panel?.jumpToInlineDiagram(item.diagram.id)}
                            />
                        );
                    }

                    const fileSource = item.source;
                    const fileId = getFileId(fileSource);
                    const referencesInFile = referencesGroupedByFile.get(fileId) || [];
                    const hoveredReferenceInFile = referencesInFile.some(r => r.id === hoveredReference?.id) ? hoveredReference : undefined;
                    const selectedReferenceInFile = referencesInFile.some(r => r.id === selectedReference?.id) ? selectedReference : undefined;

                    return (
                        <ReferencedFileSourceListItemContainer
                            key={fileId}
                            fileId={fileId}
                            fileSource={fileSource}
                            references={referencesInFile}
                            hoveredReference={hoveredReferenceInFile}
                            selectedReference={selectedReferenceInFile}
                            onHoveredReferenceChanged={onHoveredReferenceChanged}
                            onSelectedReferenceChanged={onSelectedReferenceChanged}
                            isExpanded={!collapsedFileIds.includes(fileId)}
                            onExpandedChanged={onExpandedChanged}
                            onEditorRef={setEditorRef}
                        />
                    );
                })}
            </div>
        </ScrollArea>
    );
}

// Memoize to prevent unnecessary re-renders
export const ReferencedSourcesListView = memo(ReferencedSourcesListViewComponent, isEqual);
