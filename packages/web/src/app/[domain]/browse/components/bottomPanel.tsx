'use client';

import { ResizablePanel } from "@/components/ui/resizable";
import { useQuery } from "@tanstack/react-query";
import { useDomain } from "@/hooks/useDomain";
import { base64Decode, isServiceError, unwrapServiceError } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { findSearchBasedSymbolReferences } from "@/features/codeNav/actions";
import { FindSearchBasedSymbolReferencesResponse } from "@/features/codeNav/types";
import { RepositoryInfo, SourceRange } from "@/features/search/types";
import { useEffect, useMemo, useRef } from "react";
import { FileHeader } from "@/app/[domain]/components/fileHeader";
import { LightweightCodeHighlighter } from "@/app/[domain]/components/lightweightCodeHighlighter";
import { useRouter, useSearchParams } from "next/navigation";
import { useBrowseState } from "../useBrowseState";
import { ImperativePanelHandle } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { KeyboardShortcutHint } from "@/app/components/keyboardShortcutHint";
import { useHotkeys } from "react-hotkeys-hook";
import { Separator } from "@/components/ui/separator";
import { FaChevronDown } from "react-icons/fa";
import { Loader2 } from "lucide-react";
import { VscSymbolMisc } from "react-icons/vsc";

export const BottomPanel = () => {
    const domain = useDomain();
    const panelRef = useRef<ImperativePanelHandle>(null);

    const {
        state: { selectedSymbolInfo, isBottomPanelCollapsed },
        updateBrowseState,
    } = useBrowseState();

    useEffect(() => {
        if (isBottomPanelCollapsed) {
            panelRef.current?.collapse();
        } else {
            panelRef.current?.expand();
        }
    }, [isBottomPanelCollapsed]);

    const { data: response, isLoading } = useQuery({
        queryKey: ["references", selectedSymbolInfo],
        queryFn: () => unwrapServiceError(findSearchBasedSymbolReferences(selectedSymbolInfo!.symbolName, selectedSymbolInfo!.repoName, domain)),
        enabled: !!selectedSymbolInfo,
    });

    useHotkeys("shift+mod+e", (event) => {
        event.preventDefault();
        updateBrowseState({ isBottomPanelCollapsed: !isBottomPanelCollapsed });
    }, {
        enableOnFormTags: true,
        enableOnContentEditable: true,
        description: "Open Explore Panel",
    });

    return (
        <>
            <div className="w-full flex flex-row justify-between">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        updateBrowseState({
                            isBottomPanelCollapsed: !isBottomPanelCollapsed,
                        })
                    }}
                >
                    <KeyboardShortcutHint shortcut="⇧ ⌘ E" />
                    Explore
                </Button>

                {!isBottomPanelCollapsed && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            updateBrowseState({ isBottomPanelCollapsed: true })
                        }}
                    >
                        <FaChevronDown className="w-4 h-4" />
                        Hide
                    </Button>
                )}
            </div>
            <Separator />
            <ResizablePanel
                minSize={20}
                maxSize={40}
                collapsible={true}
                ref={panelRef}
                defaultSize={isBottomPanelCollapsed ? 0 : undefined}
                onCollapse={() => updateBrowseState({ isBottomPanelCollapsed: true })}
                onExpand={() => updateBrowseState({ isBottomPanelCollapsed: false })}
                order={2}
                id={"bottom-panel"}
            >
                {!selectedSymbolInfo ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <VscSymbolMisc className="w-6 h-6 mb-2" />
                        <p className="text-sm">No symbol selected</p>
                    </div>
                ) :
                    isLoading ? (
                        <div className="flex flex-row items-center justify-center h-full">
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Loading...
                        </div>
                    ) :
                        (!response || isServiceError(response)) ? (
                            <p>Error loading references</p>
                        ) : (
                            <ReferenceList
                                data={response}
                            />
                        )}
            </ResizablePanel>
        </>
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
    const searchParams = useSearchParams();
    const domain = useDomain();

    return (
        <ScrollArea className="h-full">
            {data.files.map((file, index) => {
                const repoInfo = repoInfoMap[file.repositoryId];

                return (
                    <div key={index}>
                        <div className="bg-accent py-1 px-2 flex flex-row sticky top-0 z-10">
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

                                            const params = new URLSearchParams(searchParams.toString());
                                            params.set('highlightRange', highlightRange);
                                            router.push(`/${domain}/browse/${file.repository}@HEAD/-/blob/${file.fileName}?${params.toString()}`);
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

    const highlightRanges = useMemo(() => [range], [range]);

    return (
        <div
            className="w-full hover:bg-accent py-1 cursor-pointer"
            onClick={onClick}
        >
            <LightweightCodeHighlighter
                language="JavaScript"
                highlightRanges={highlightRanges}
                lineNumbers={true}
                lineNumbersOffset={range.start.lineNumber}
                removeTrailingNewline={true}
                renderWhitespace={false}
            >
                {decodedLineContent}
            </LightweightCodeHighlighter>
        </div>
    )
}
