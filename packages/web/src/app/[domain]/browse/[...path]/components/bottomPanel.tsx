'use client';

import { ResizablePanel } from "@/components/ui/resizable";
import { useQuery } from "@tanstack/react-query";
import { useDomain } from "@/hooks/useDomain";
import { base64Decode, isServiceError, unwrapServiceError } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { findSearchBasedSymbolReferences } from "@/features/codeNav/actions";
import { FindSearchBasedSymbolReferencesResponse } from "@/features/codeNav/types";
import { RepositoryInfo } from "@/features/search/types";
import { useMemo } from "react";
import { FileHeader } from "@/app/[domain]/components/fileHeader";
import { ReadOnlyCodeBlock } from "@/app/[domain]/components/readOnlyCodeBlock";

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
            maxSize={30}
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
    data
}: ReferenceListProps) => {
    const repoInfoMap = useMemo(() => {
        return data.repositoryInfo.reduce((acc, repo) => {
            acc[repo.id] = repo;
            return acc;
        }, {} as Record<number, RepositoryInfo>);
    }, [data.repositoryInfo]);

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
                        {file.references
                            .sort((a, b) => a.range.start.lineNumber - b.range.start.lineNumber)
                            .map((reference, index) => (
                                <div
                                    key={index}
                                >
                                    <ReadOnlyCodeBlock
                                        language="JavaScript"
                                        highlightRanges={[
                                            {
                                                from: reference.range.start.column - 1,
                                                to: reference.range.end.column - 1,
                                            }
                                        ]}
                                    >
                                        {base64Decode(reference.lineContent)}
                                    </ReadOnlyCodeBlock>
                                </div>
                            ))}
                    </div>
                )
            })}
        </ScrollArea>
    )
}
