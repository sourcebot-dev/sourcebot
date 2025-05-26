'use client';

import { useBrowseNavigation } from "@/app/[domain]/browse/hooks/useBrowseNavigation";
import { FileHeader } from "@/app/[domain]/components/fileHeader";
import { LightweightCodeHighlighter } from "@/app/[domain]/components/lightweightCodeHighlighter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FindRelatedSymbolsResponse } from "@/features/codeNav/types";
import { RepositoryInfo, SourceRange } from "@/features/search/types";
import { base64Decode } from "@/lib/utils";
import { useMemo } from "react";

interface ReferenceListProps {
    data: FindRelatedSymbolsResponse;
    revisionName: string;
}

export const ReferenceList = ({
    data,
    revisionName,
}: ReferenceListProps) => {
    const repoInfoMap = useMemo(() => {
        return data.repositoryInfo.reduce((acc, repo) => {
            acc[repo.id] = repo;
            return acc;
        }, {} as Record<number, RepositoryInfo>);
    }, [data.repositoryInfo]);

    const { navigateToPath } = useBrowseNavigation();

    return (
        <ScrollArea className="h-full">
            {data.files.map((file, index) => {
                const repoInfo = repoInfoMap[file.repositoryId];

                return (
                    <div key={index}>
                        <div className="bg-accent py-1 px-2 flex flex-row sticky top-0">
                            <FileHeader
                                repo={{
                                    name: repoInfo.name,
                                    displayName: repoInfo.displayName,
                                    codeHostType: repoInfo.codeHostType,
                                    webUrl: repoInfo.webUrl,
                                }}
                                fileName={file.fileName}
                                branchDisplayName={revisionName === "HEAD" ? undefined : revisionName}
                            />
                        </div>
                        <div className="divide-y">
                            {file.matches
                                .sort((a, b) => a.range.start.lineNumber - b.range.start.lineNumber)
                                .map((match, index) => (
                                    <ReferenceListItem
                                        key={index}
                                        lineContent={match.lineContent}
                                        range={match.range}
                                        language={file.language}
                                        onClick={() => {
                                            navigateToPath({
                                                repoName: file.repository,
                                                revisionName,
                                                path: file.fileName,
                                                pathType: 'blob',
                                                highlightRange: match.range,
                                            })
                                        }}
                                    />
                                ))}
                        </div>
                    </div>
                )
            })}
        </ScrollArea>
    )
}


interface ReferenceListItemProps {
    lineContent: string;
    range: SourceRange;
    language: string;
    onClick: () => void;
}

const ReferenceListItem = ({
    lineContent,
    range,
    language,
    onClick,
}: ReferenceListItemProps) => {
    const decodedLineContent = useMemo(() => {
        return base64Decode(lineContent);
    }, [lineContent]);

    const highlightRanges = useMemo(() => [range], [range]);

    return (
        <div
            className="w-full hover:bg-accent py-1 cursor-pointer"
            onClick={onClick}
        >
            <LightweightCodeHighlighter
                language={language}
                highlightRanges={highlightRanges}
                lineNumbers={true}
                lineNumbersOffset={range.start.lineNumber}
                renderWhitespace={false}
            >
                {decodedLineContent}
            </LightweightCodeHighlighter>
        </div>
    )
}
