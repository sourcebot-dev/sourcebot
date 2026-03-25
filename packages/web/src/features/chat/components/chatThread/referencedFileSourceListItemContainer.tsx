'use client';

import { getFileSource } from "@/app/api/(client)/client";
import { VscodeFileIcon } from "@/app/components/vscodeFileIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { isServiceError, unwrapServiceError } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { memo, useCallback } from "react";
import { FileReference, FileSource, Reference } from "../../types";
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

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['fileSource', fileSource.path, fileSource.repo, fileSource.revision],
        queryFn: () => unwrapServiceError(getFileSource({
            path: fileSource.path,
            repo: fileSource.repo,
            ref: fileSource.revision,
        })),
        staleTime: Infinity,
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

    if (isError || isServiceError(data)) {
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

    const fileData = data!;

    return (
        <ReferencedFileSourceListItem
            id={fileId}
            code={fileData.source}
            language={fileData.language}
            revision={fileSource.revision}
            repoName={fileSource.repo}
            repoCodeHostType={fileData.repoCodeHostType}
            repoDisplayName={fileData.repoDisplayName}
            repoWebUrl={fileData.repoExternalWebUrl}
            fileName={fileData.path}
            references={references}
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
