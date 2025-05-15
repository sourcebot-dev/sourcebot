'use client';

import { fetchFileSource } from "@/app/api/(client)/client";
import { base64Decode } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { CodePreview, CodePreviewFile } from "./codePreview";
import { SearchResultFile } from "@/features/search/types";
import { useDomain } from "@/hooks/useDomain";
import { SymbolIcon } from "@radix-ui/react-icons";

interface CodePreviewPanelProps {
    fileMatch?: SearchResultFile;
    onClose: () => void;
    selectedMatchIndex: number;
    onSelectedMatchIndexChange: (index: number) => void;
}

export const CodePreviewPanel = ({
    fileMatch,
    onClose,
    selectedMatchIndex,
    onSelectedMatchIndexChange,
}: CodePreviewPanelProps) => {
    const domain = useDomain();

    const { data: file, isLoading } = useQuery({
        queryKey: ["source", fileMatch?.fileName, fileMatch?.repository, fileMatch?.branches],
        queryFn: async (): Promise<CodePreviewFile | undefined> => {
            if (!fileMatch) {
                return undefined;
            }

            // If there are multiple branches pointing to the same revision of this file, it doesn't
            // matter which branch we use here, so use the first one.
            const branch = fileMatch.branches && fileMatch.branches.length > 0 ? fileMatch.branches[0] : undefined;

            return fetchFileSource({
                fileName: fileMatch.fileName.text,
                repository: fileMatch.repository,
                branch,
            }, domain)
                .then(({ source }) => {
                    const decodedSource = base64Decode(source);

                    return {
                        content: decodedSource,
                        filepath: fileMatch.fileName.text,
                        matches: fileMatch.chunks,
                        link: fileMatch.webUrl,
                        language: fileMatch.language,
                        revision: branch ?? "HEAD",
                    };
                });
        },
        enabled: fileMatch !== undefined,
    });

    if (isLoading) {
        return <div className="flex flex-col items-center justify-center h-full">
            <SymbolIcon className="h-6 w-6 animate-spin" />
            <p className="font-semibold text-center">Loading...</p>
        </div>
    }

    return (
        <CodePreview
            file={file}
            repoName={fileMatch?.repository}
            onClose={onClose}
            selectedMatchIndex={selectedMatchIndex}
            onSelectedMatchIndexChange={onSelectedMatchIndexChange}
        />
    )
}