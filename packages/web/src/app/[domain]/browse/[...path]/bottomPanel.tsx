'use client';

import { ResizablePanel } from "@/components/ui/resizable";
import { useQuery } from "@tanstack/react-query";
import { useDomain } from "@/hooks/useDomain";
import { base64Decode, isServiceError, unwrapServiceError } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { findSearchBasedSymbolReferences } from "@/features/codeNav/actions";
import { Reference } from "@/features/codeNav/types";


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

    console.log(response);

    return (
        <ResizablePanel
            minSize={20}
            maxSize={30}
            collapsedSize={5}
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
                            references={response.references}
                        />
                    )}
        </ResizablePanel>
    )
}

const ReferenceList = ({ references }: { references: Reference[] }) => {

    const aggregatedReferences = references.reduce((acc, reference) => {
        const key = reference.fileName;
        acc[key] = [...(acc[key] || []), reference];
        return acc;
    }, {} as Record<string, Reference[]>);

    console.log(aggregatedReferences);
    
    return (
        <ScrollArea className="h-full">
            {Object.entries(aggregatedReferences).map(([fileName, references], index) => (
                <div key={index}>
                    <p className="text-sm font-bold">{fileName}</p>
                    {references.map((reference, index) => (
                        <div key={index}>
                            <p>{reference.repository}</p>
                            <p>{base64Decode(reference.lineContent)}</p>
                        </div>
                    ))}
                </div>
            ))}
        </ScrollArea>
    )
}   
