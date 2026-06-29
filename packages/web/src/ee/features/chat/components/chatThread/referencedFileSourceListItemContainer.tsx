'use client';

import { getFileFreshness, getFileSource } from "@/app/api/(client)/client";
import { VscodeFileIcon } from "@/app/components/vscodeFileIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { isServiceError, unwrapServiceError } from "@/lib/utils";
import { ErrorCode } from "@/lib/errorCodes";
import { useQuery } from "@tanstack/react-query";
import { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { memo, useCallback } from "react";
import { FileReference, FileSource, Reference } from "@/features/chat/types";
import { ReferencedFileSourceListItem } from "./referencedFileSourceListItem";
import isEqual from 'fast-deep-equal/react';

export interface ReferencedFileSourceListItemContainerProps {
    fileId: string;
    fileSource: FileSource;
    references: FileReference[];
    hoveredReference?: Reference;
    selectedReference?: Reference;
    onHoveredReferenceChanged: (reference?: Reference) => void;
    onSelectedReferenceChanged: (reference?: Reference) => void;
    isExpanded: boolean;
    onExpandedChanged: (fileId: string, isExpanded: boolean) => void;
    onEditorRef: (fileId: string, ref: ReactCodeMirrorRef | null) => void;
}

const ReferencedFileSourceListItemContainerComponent = ({
    fileId,
    fileSource,
    references,
    hoveredReference,
    selectedReference,
    onHoveredReferenceChanged,
    onSelectedReferenceChanged,
    isExpanded,
    onExpandedChanged,
    onEditorRef,
}: ReferencedFileSourceListItemContainerProps) => {
    const fileName = fileSource.path.split('/').pop() ?? fileSource.path;

    // Prefer the pinned commit SHA so the file renders as it was when answered,
    // with line ranges still aligned. Falls back to the symbolic ref.
    const fetchRef = fileSource.commitSha ?? fileSource.revision;

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['fileSource', fileSource.path, fileSource.repo, fetchRef, fileSource.revision],
        queryFn: async () => {
            const pinned = await getFileSource({
                path: fileSource.path,
                repo: fileSource.repo,
                ref: fetchRef,
            });

            // A gone pinned commit (e.g. force-push + GC) surfaces as an
            // unresolvable ref. Only then fall back to the symbolic ref; other
            // errors are surfaced as-is rather than silently showing latest.
            if (
                isServiceError(pinned) &&
                pinned.errorCode === ErrorCode.INVALID_GIT_REF &&
                fetchRef !== fileSource.revision
            ) {
                return unwrapServiceError(getFileSource({
                    path: fileSource.path,
                    repo: fileSource.repo,
                    ref: fileSource.revision,
                }));
            }

            return unwrapServiceError(Promise.resolve(pinned));
        },
        staleTime: Infinity,
    });

    // Whether the cited file has changed since the pinned commit. Only checked
    // for pinned sources; older un-pinned sources have nothing to compare.
    const { data: freshness } = useQuery({
        queryKey: ['fileFreshness', fileSource.repo, fileSource.path, fileSource.commitSha],
        queryFn: () => unwrapServiceError(getFileFreshness({
            repo: fileSource.repo,
            path: fileSource.path,
            sinceSha: fileSource.commitSha!,
        })),
        enabled: !!fileSource.commitSha,
        staleTime: 5 * 60 * 1000,
    });

    const handleRef = useCallback((ref: ReactCodeMirrorRef | null) => {
        onEditorRef(fileId, ref);
    }, [fileId, onEditorRef]);

    const handleExpandedChanged = useCallback((isExpanded: boolean) => {
        onExpandedChanged(fileId, isExpanded);
    }, [fileId, onExpandedChanged]);

    if (isLoading) {
        return (
            <div className="space-y-2">
                <div className="flex items-center gap-2 p-2">
                    <VscodeFileIcon fileName={fileName} className="w-4 h-4" />
                    <span className="text-sm font-medium">{fileName}</span>
                </div>
                <Skeleton className="h-48 w-full" />
            </div>
        );
    }

    if (isError || isServiceError(data) || !data) {
        return (
            <div className="space-y-2">
                <div className="flex items-center gap-2 p-2">
                    <VscodeFileIcon fileName={fileName} className="w-4 h-4" />
                    <span className="text-sm font-medium">{fileName}</span>
                </div>
                <div className="p-4 text-sm text-destructive bg-destructive/10 rounded border">
                    Failed to load file: {isServiceError(data) ? data.message : error?.message ?? 'Unknown error'}
                </div>
            </div>
        );
    }

    return (
        <ReferencedFileSourceListItem
            id={fileId}
            code={data.source}
            language={data.language}
            revision={fileSource.revision}
            repoName={fileSource.repo}
            repoCodeHostType={data.repoCodeHostType}
            repoDisplayName={data.repoDisplayName}
            repoWebUrl={data.repoExternalWebUrl}
            fileName={data.path}
            references={references}
            pinnedSha={fileSource.commitSha}
            freshnessStatus={freshness?.status}
            currentSha={freshness?.currentSha}
            ref={handleRef}
            onSelectedReferenceChanged={onSelectedReferenceChanged}
            onHoveredReferenceChanged={onHoveredReferenceChanged}
            selectedReference={selectedReference}
            hoveredReference={hoveredReference}
            isExpanded={isExpanded}
            onExpandedChanged={handleExpandedChanged}
        />
    );
};

export const ReferencedFileSourceListItemContainer = memo(ReferencedFileSourceListItemContainerComponent, isEqual);
