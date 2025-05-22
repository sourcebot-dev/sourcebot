'use client';

import { ResizablePanel } from "@/components/ui/resizable";
import { useQuery } from "@tanstack/react-query";
import { useDomain } from "@/hooks/useDomain";
import { base64Decode, createPathWithQueryParams, isServiceError, unwrapServiceError } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { findSearchBasedSymbolReferences } from "@/features/codeNav/actions";
import { FindSearchBasedSymbolReferencesResponse } from "@/features/codeNav/types";
import { RepositoryInfo, SourceRange } from "@/features/search/types";
import { useMemo } from "react";
import { FileHeader } from "@/app/[domain]/components/fileHeader";
import { ReadOnlyCodeBlock } from "@/app/[domain]/components/readOnlyCodeBlock";
import { useRouter } from "next/navigation";

interface BottomPanelProps {
    selectedSymbol: string | null;
    repoName: string;
}

export const BottomPanel = ({
    selectedSymbol,
    repoName,
}: BottomPanelProps) => {
    const domain = useDomain();

    const { data: response, isLoading } = useQuery({
        queryKey: ["references", selectedSymbol],
        queryFn: () => unwrapServiceError(findSearchBasedSymbolReferences(selectedSymbol!, repoName, domain)),
        enabled: !!selectedSymbol,
    });

    return (
        <ResizablePanel
            minSize={10}
            maxSize={40}
            collapsible={true}
        >
            {!selectedSymbol ? (
                <p>No symbol selected</p>
            ) :
                isLoading ? (
                    <p>Loading...</p>
                ) :
                    (!response || isServiceError(response)) ? (
                        <p>Error loading references</p>
                    ) : (
                        <ReferenceList
                            data={response}
                        />
                    )}
        </ResizablePanel>
    )
}

interface ReferenceListProps {
    data: FindSearchBasedSymbolReferencesResponse;
}

const ReferenceList = ({
    data,
}: ReferenceListProps) => {
    const repoInfoMap = useMemo(() => {
        return data.repositoryInfo.reduce((acc, repo) => {
            acc[repo.id] = repo;
            return acc;
        }, {} as Record<number, RepositoryInfo>);
    }, [data.repositoryInfo]);

    const router = useRouter();
    const domain = useDomain();

    return (
        <ScrollArea className="h-full">
            {data.files.map((file, index) => {
                const repoInfo = repoInfoMap[file.repositoryId];

                return (
                    <div key={index}>
                        <div className="bg-accent py-1 px-2 flex flex-row">
                            <FileHeader
                                repo={{
                                    name: repoInfo.name,
                                    displayName: repoInfo.displayName,
                                    codeHostType: repoInfo.codeHostType,
                                    webUrl: repoInfo.webUrl,
                                }}
                                fileName={file.fileName}
                            />
                        </div>
                        <div className="divide-y">
                            {file.references
                                .sort((a, b) => a.range.start.lineNumber - b.range.start.lineNumber)
                                .map((reference, index) => (
                                    <ReferenceListItem
                                        key={index}
                                        lineContent={reference.lineContent}
                                        range={reference.range}
                                        onClick={() => {
                                            const { start, end } = reference.range;
                                            const highlightRange = `${start.lineNumber}:${start.column},${end.lineNumber}:${end.column}`;

                                            const url = createPathWithQueryParams(`/${domain}/browse/${file.repository}@HEAD/-/blob/${file.fileName}`,
                                                ['highlightRange', highlightRange]
                                            );
                                            router.push(url);
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
    onClick: () => void;
}

const ReferenceListItem = ({
    lineContent,
    range,
    onClick,
}: ReferenceListItemProps) => {
    const decodedLineContent = useMemo(() => {
        return base64Decode(lineContent);
    }, [lineContent]);

    return (
        <div
            className="w-full hover:bg-accent py-1 cursor-pointer"
            onClick={onClick}
        >
            <ReadOnlyCodeBlock
                language="JavaScript"
                highlightRanges={[range]}
                lineNumbers={true}
                lineNumbersOffset={range.start.lineNumber}
            >
                {decodedLineContent}
            </ReadOnlyCodeBlock>
        </div>
    )
}
