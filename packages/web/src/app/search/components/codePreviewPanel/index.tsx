'use client';

import { fetchFileSource } from "@/app/api/(client)/client";
import { getCodeHostFilePreviewLink, base64Decode } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { CodePreview, CodePreviewFile } from "./codePreview";
import { SearchResultFile } from "@/lib/types";

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

    const { data: file } = useQuery({
        queryKey: ["source", fileMatch?.FileName, fileMatch?.Repository, fileMatch?.Branches],
        queryFn: async (): Promise<CodePreviewFile | undefined> => {
            if (!fileMatch) {
                return undefined;
            }

            // If there are multiple branches pointing to the same revision of this file, it doesn't
            // matter which branch we use here, so use the first one.
            const branch = fileMatch.Branches && fileMatch.Branches.length > 0 ? fileMatch.Branches[0] : undefined;

            return fetchFileSource({
                fileName: fileMatch.FileName,
                repository: fileMatch.Repository,
                branch,
            })
                .then(({ source }) => {
                    // @todo : refector this to use the templates provided by zoekt.
                    const link = getCodeHostFilePreviewLink(fileMatch.Repository, fileMatch.FileName)

                    const decodedSource = base64Decode(source);

                    // Filter out filename matches
                    const filteredMatches = fileMatch.ChunkMatches.filter((match) => {
                        return !match.FileName;
                    });

                    return {
                        content: decodedSource,
                        filepath: fileMatch.FileName,
                        matches: filteredMatches,
                        link: link,
                        language: fileMatch.Language,
                    };
                });
        },
        enabled: fileMatch !== undefined,
    });

    return (
        <CodePreview
            file={file}
            onClose={onClose}
            selectedMatchIndex={selectedMatchIndex}
            onSelectedMatchIndexChange={onSelectedMatchIndexChange}
        />
    )
}