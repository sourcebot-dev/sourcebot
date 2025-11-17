'use client';

import { getFileSource } from "@/app/api/(client)/client";
import { VscodeFileIcon } from "@/app/components/vscodeFileIcon";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useDomain } from "@/hooks/useDomain";
import { isServiceError, unwrapServiceError } from "@/lib/utils";
import { useQueries } from "@tanstack/react-query";
import { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import scrollIntoView from 'scroll-into-view-if-needed';
import { FileReference, FileSource, Reference, Source } from "../../types";
import ReferencedFileSourceListItem from "./referencedFileSourceListItem";

interface ReferencedSourcesListViewProps {
    references: FileReference[];
    sources: Source[];
    index: number;
    hoveredReference?: Reference;
    onHoveredReferenceChanged: (reference?: Reference) => void;
    selectedReference?: Reference;
    onSelectedReferenceChanged: (reference?: Reference) => void;
    style: React.CSSProperties;
}

const resolveFileReference = (reference: FileReference, sources: FileSource[]): FileSource | undefined => {
    return sources.find(
        (source) => source.repo.endsWith(reference.repo) &&
            source.path.endsWith(reference.path)
    );
}

export const ReferencedSourcesListView = ({
    references,
    sources,
    index,
    hoveredReference,
    selectedReference,
    style,
    onHoveredReferenceChanged,
    onSelectedReferenceChanged,
}: ReferencedSourcesListViewProps) => {
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const editorRefsMap = useRef<Map<string, ReactCodeMirrorRef>>(new Map());
    const domain = useDomain();
    const [collapsedFileIds, setCollapsedFileIds] = useState<string[]>([]);

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

    const referencedFileSources = useMemo((): FileSource[] => {
        const fileSources = sources.filter((source) => source.type === 'file');

        return references
            .filter((reference) => reference.type === 'file')
            .map((reference) => resolveFileReference(reference, fileSources))
            .filter((file) => file !== undefined)
            // de-duplicate files
            .filter((file, index, self) =>
                index === self.findIndex((t) =>
                    t?.path === file?.path
                    && t?.repo === file?.repo
                    && t?.revision === file?.revision
                )
            );
    }, [references, sources]);

    // Memoize the computation of references grouped by file source
    const referencesGroupedByFile = useMemo(() => {
        const groupedReferences = new Map<string, FileReference[]>();

        for (const fileSource of referencedFileSources) {
            const fileKey = getFileId(fileSource);
            const referencesInFile = references.filter((reference) => {
                if (reference.type !== 'file') {
                    return false;
                }
                return resolveFileReference(reference, [fileSource]) !== undefined;
            });
            groupedReferences.set(fileKey, referencesInFile);
        }

        return groupedReferences;
    }, [references, referencedFileSources, getFileId]);

    const fileSourceQueries = useQueries({
        queries: referencedFileSources.map((file) => ({
            queryKey: ['fileSource', file.path, file.repo, file.revision, domain],
            queryFn: () => unwrapServiceError(getFileSource({
                fileName: file.path,
                repository: file.repo,
                branch: file.revision,
            })),
            staleTime: Infinity,
        })),
    });


    useEffect(() => {
        if (!selectedReference || selectedReference.type !== 'file') {
            return;
        }

        const fileSource = resolveFileReference(selectedReference, referencedFileSources);
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
            const view = editorRef.view;
            const lineNumber = selectedReference.range.startLine;

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

            // Expand the file if it's collapsed.
            setCollapsedFileIds((collapsedFileIds) => collapsedFileIds.filter((id) => id !== fileId));

            // Scroll to the calculated position
            // @NOTE: Using requestAnimationFrame is a bit of a hack to ensure
            // that the collapsed file ids state has updated before scrolling.
            requestAnimationFrame(() => {
                scrollAreaViewport.scrollTo({
                    top: Math.max(0, targetScrollTop),
                    behavior: 'smooth',
                });
            });
        }

        // Otherwise, fallback to scrolling to the top of the file.
        else {
            scrollIntoView(fileSourceElement, {
                scrollMode: 'if-needed',
                block: 'start',
                behavior: 'smooth',
            });
        }
    }, [getFileId, referencedFileSources, selectedReference]);

    if (referencedFileSources.length === 0) {
        return (
            <div className="p-4 text-center text-muted-foreground text-sm">
                No file references found
            </div>
        );
    }

    return (
        <ScrollArea
            ref={scrollAreaRef}
            style={style}
        >
            <div className="space-y-4 pr-2">
                {fileSourceQueries.map((query, index) => {
                    const fileSource = referencedFileSources[index];
                    const fileName = fileSource.path.split('/').pop() ?? fileSource.path;

                    if (query.isLoading) {
                        return (
                            <div key={`${fileSource.repo}/${fileSource.path}`} className="space-y-2">
                                <div className="flex items-center gap-2 p-2">
                                    <VscodeFileIcon fileName={fileName} className="w-4 h-4" />
                                    <span className="text-sm font-medium">{fileName}</span>
                                </div>
                                <Skeleton className="h-48 w-full" />
                            </div>
                        );
                    }

                    if (query.isError || isServiceError(query.data)) {
                        return (
                            <div key={`${fileSource.repo}/${fileSource.path}`} className="space-y-2">
                                <div className="flex items-center gap-2 p-2">
                                    <VscodeFileIcon fileName={fileName} className="w-4 h-4" />
                                    <span className="text-sm font-medium">{fileName}</span>
                                </div>
                                <div className="p-4 text-sm text-destructive bg-destructive/10 rounded border">
                                    Failed to load file: {isServiceError(query.data) ? query.data.message : query.error?.message ?? 'Unknown error'}
                                </div>
                            </div>
                        );
                    }

                    const fileData = query.data!;

                    const fileId = getFileId(fileSource);
                    const referencesInFile = referencesGroupedByFile.get(fileId) || [];

                    return (
                        <ReferencedFileSourceListItem
                            key={fileId}
                            id={fileId}
                            code={fileData.source}
                            language={fileData.language}
                            revision={fileSource.revision}
                            repoName={fileSource.repo}
                            repoCodeHostType={fileData.repositoryCodeHostType}
                            repoDisplayName={fileData.repositoryDisplayName}
                            repoWebUrl={fileData.repositoryWebUrl}
                            fileName={fileData.path}
                            references={referencesInFile}
                            ref={ref => {
                                setEditorRef(fileId, ref);
                            }}
                            onSelectedReferenceChanged={onSelectedReferenceChanged}
                            onHoveredReferenceChanged={onHoveredReferenceChanged}
                            selectedReference={selectedReference}
                            hoveredReference={hoveredReference}
                            isExpanded={!collapsedFileIds.includes(fileId)}
                            onExpandedChanged={(isExpanded) => {
                                if (isExpanded) {
                                    setCollapsedFileIds(collapsedFileIds.filter((id) => id !== fileId));
                                } else {
                                    setCollapsedFileIds([...collapsedFileIds, fileId]);
                                }

                                // When collapsing a file when you are deep in a scroll, it's a better
                                // experience to have the scroll automatically restored to the top of the file
                                // s.t., header is still sticky to the top of the scroll area.
                                if (!isExpanded) {
                                    const fileSourceStart = document.getElementById(`${fileId}-start`);
                                    if (!fileSourceStart) {
                                        return;
                                    }

                                    scrollIntoView(fileSourceStart, {
                                        scrollMode: 'if-needed',
                                        block: 'start',
                                        behavior: 'instant',
                                    });
                                }
                            }
                            }
                        />
                    );
                })}
            </div>
        </ScrollArea>
    );
}
