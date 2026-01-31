'use client';

import { useQuery } from "@tanstack/react-query";
import { CodePreview } from "./codePreview";
import { SearchResultFile } from "@/features/search";
import { SymbolIcon } from "@radix-ui/react-icons";
import { SetStateAction, Dispatch, useMemo } from "react";
import { unwrapServiceError } from "@/lib/utils";
import { getFileSource } from "@/app/api/(client)/client";

interface CodePreviewPanelProps {
    previewedFile: SearchResultFile;
    selectedMatchIndex: number;
    onClose: () => void;
    onSelectedMatchIndexChange: Dispatch<SetStateAction<number>>;
}

export const CodePreviewPanel = ({
    previewedFile,
    selectedMatchIndex,
    onClose,
    onSelectedMatchIndexChange,
}: CodePreviewPanelProps) => {

    // If there are multiple branches pointing to the same revision of this file, it doesn't
    // matter which branch we use here, so use the first one.
    const branch = useMemo(() => {
        return previewedFile.branches && previewedFile.branches.length > 0 ? previewedFile.branches[0] : undefined;
    }, [previewedFile]);

    const { data: file, isLoading, isPending, isError } = useQuery({
        queryKey: ["source", previewedFile, branch],
        queryFn: () => unwrapServiceError(
            getFileSource({
                path: previewedFile.fileName.text,
                repo: previewedFile.repository,
                ref: branch,
            })
        ),
        select: (data) => {
            return {
                content: data.source,
                filepath: previewedFile.fileName.text,
                matches: previewedFile.chunks,
                link: previewedFile.externalWebUrl,
                language: previewedFile.language,
                revision: branch ?? "HEAD",
            };
        }
    });

    if (isLoading || isPending) {
        return <div className="flex flex-col items-center justify-center h-full">
            <SymbolIcon className="h-6 w-6 animate-spin" />
            <p className="font-semibold text-center">Loading...</p>
        </div>
    }

    if (isError) {
        return (
            <p>Failed to load file source</p>
        )
    }

    return (
        <CodePreview
            file={file}
            repoName={previewedFile.repository}
            selectedMatchIndex={selectedMatchIndex}
            onSelectedMatchIndexChange={onSelectedMatchIndexChange}
            onClose={onClose}
        />
    )
}