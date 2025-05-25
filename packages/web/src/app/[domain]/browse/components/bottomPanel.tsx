'use client';

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useQuery } from "@tanstack/react-query";
import { useDomain } from "@/hooks/useDomain";
import { base64Decode, unwrapServiceError } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { findSearchBasedSymbolDefinitions, findSearchBasedSymbolReferences } from "@/features/codeNav/actions";
import { FindRelatedSymbolsResponse } from "@/features/codeNav/types";
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
import { VscSymbolMisc, VscReferences } from "react-icons/vsc";
import { Badge } from "@/components/ui/badge";
import clsx from "clsx";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export const BottomPanel = () => {
    const panelRef = useRef<ImperativePanelHandle>(null);

    const {
        state: { selectedSymbolInfo, isBottomPanelCollapsed, bottomPanelSize },
        updateBrowseState,
    } = useBrowseState();

    useEffect(() => {
        if (isBottomPanelCollapsed) {
            panelRef.current?.collapse();
        } else {
            panelRef.current?.expand();
        }
    }, [isBottomPanelCollapsed]);

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
                <div className="flex flex-row gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            updateBrowseState({
                                isBottomPanelCollapsed: !isBottomPanelCollapsed,
                            })
                        }}
                    >
                        <VscReferences className="w-4 h-4" />
                        Explore
                        <KeyboardShortcutHint shortcut="⇧ ⌘ E" />
                    </Button>
                </div>

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
                maxSize={50}
                collapsible={true}
                ref={panelRef}
                defaultSize={isBottomPanelCollapsed ? 0 : bottomPanelSize}
                onCollapse={() => updateBrowseState({ isBottomPanelCollapsed: true })}
                onExpand={() => updateBrowseState({ isBottomPanelCollapsed: false })}
                onResize={(size) => {
                    if (!isBottomPanelCollapsed) {
                        updateBrowseState({ bottomPanelSize: size });
                    }
                }}
                order={2}
                id={"bottom-panel"}
            >
                {!selectedSymbolInfo ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <VscSymbolMisc className="w-6 h-6 mb-2" />
                        <p className="text-sm">No symbol selected</p>
                    </div>
                ) : (
                    <ExploreMenu
                        selectedSymbolInfo={selectedSymbolInfo}
                    />
                )}
            </ResizablePanel>
        </>
    )
}

interface ExploreMenuProps {
    selectedSymbolInfo: {
        symbolName: string;
        repoName: string;
        revisionName: string;
    }
}

const ExploreMenu = ({
    selectedSymbolInfo,
}: ExploreMenuProps) => {

    const domain = useDomain();
    const {
        state: { activeExploreMenuTab },
        updateBrowseState,
    } = useBrowseState();

    const {
        data: referencesResponse,
        isError: isReferencesResponseError,
        isPending: isReferencesResponsePending,
        isLoading: isReferencesResponseLoading,
    } = useQuery({
        queryKey: ["references", selectedSymbolInfo.symbolName, selectedSymbolInfo.repoName, selectedSymbolInfo.revisionName, domain],
        queryFn: () => unwrapServiceError(
            findSearchBasedSymbolReferences(
                selectedSymbolInfo.symbolName,
                selectedSymbolInfo.repoName,
                domain,
                selectedSymbolInfo.revisionName,
            )
        ),
    });

    const {
        data: definitionsResponse,
        isError: isDefinitionsResponseError,
        isPending: isDefinitionsResponsePending,
        isLoading: isDefinitionsResponseLoading,
    } = useQuery({
        queryKey: ["definitions", selectedSymbolInfo.symbolName, selectedSymbolInfo.repoName, selectedSymbolInfo.revisionName, domain],
        queryFn: () => unwrapServiceError(
            findSearchBasedSymbolDefinitions(
                selectedSymbolInfo.symbolName,
                selectedSymbolInfo.repoName,
                domain,
                selectedSymbolInfo.revisionName,
            )
        ),
    });

    const isPending = isReferencesResponsePending || isDefinitionsResponsePending;
    const isLoading = isReferencesResponseLoading || isDefinitionsResponseLoading;
    const isError = isDefinitionsResponseError || isReferencesResponseError;

    if (isPending || isLoading) {
        return (
            <div className="flex flex-row items-center justify-center h-full">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Loading...
            </div>
        )
    }

    if (isError) {
        return (
            <div className="flex flex-row items-center justify-center h-full">
                <p>Error loading {activeExploreMenuTab}</p>
            </div>
        )
    }

    const data = activeExploreMenuTab === "references" ?
        referencesResponse :
        definitionsResponse;

    return (
        <ResizablePanelGroup
            direction="horizontal"
        >
            <ResizablePanel
                minSize={10}
                maxSize={20}
            >
                <div className="flex flex-col p-2">
                    <Tooltip
                        delayDuration={100}
                    >
                        <TooltipTrigger
                            disabled={true}
                            className="mr-auto"
                        >
                            <Badge
                                variant="outline"
                                className="w-fit h-fit flex-shrink-0 select-none"
                            >
                                Search Based
                            </Badge>
                        </TooltipTrigger>
                        <TooltipContent
                            side="top"
                            align="start"
                        >
                            Symbol references and definitions found using a best-guess search heuristic.
                        </TooltipContent>
                    </Tooltip>
                    <div className="flex flex-col gap-1 mt-4">
                        <Entry
                            name="References"
                            isSelected={activeExploreMenuTab === "references"}
                            count={referencesResponse?.stats.matchCount}
                            onClicked={() => {
                                updateBrowseState({ activeExploreMenuTab: "references" });
                            }}
                        />
                        <Entry
                            name="Definitions"
                            isSelected={activeExploreMenuTab === "definitions"}
                            count={definitionsResponse.stats.matchCount}
                            onClicked={() => {
                                updateBrowseState({ activeExploreMenuTab: "definitions" });
                            }}
                        />
                    </div>
                </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel>
                {data.files.length > 0 ? (
                    <ReferenceList
                        data={data}
                        revisionName={selectedSymbolInfo.revisionName}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <VscSymbolMisc className="w-6 h-6 mb-2" />
                        <p className="text-sm">No {activeExploreMenuTab} found</p>
                    </div>
                )}
            </ResizablePanel>
        </ResizablePanelGroup>

    )
}

interface EntryProps {
    name: string;
    isSelected: boolean;
    count?: number;
    onClicked: () => void;
}

const Entry = ({
    name,
    isSelected,
    count,
    onClicked,
}: EntryProps) => {
    const countText = useMemo(() => {
        if (count === undefined) {
            return "?";
        }

        if (count > 999) {
            return "999+";
        }
        return count.toString();
    }, [count]);

    return (
        <div
            className={clsx(
                "flex flex-row items-center justify-between p-1 rounded-md cursor-pointer gap-2 select-none",
                {
                    "hover:bg-gray-200 dark:hover:bg-gray-700": !isSelected,
                    "bg-blue-200 dark:bg-blue-400": isSelected,
                }
            )}
            onClick={() => onClicked()}
        >
            <p className="text-sm font-medium">{name}</p>
            <div className="px-2 py-0.5 bg-accent text-sm rounded-md">
                {countText}
            </div>
        </div>
    );
}

interface ReferenceListProps {
    data: FindRelatedSymbolsResponse;
    revisionName: string;
}

const ReferenceList = ({
    data,
    revisionName,
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
                                        onClick={() => {
                                            const { start, end } = match.range;
                                            const highlightRange = `${start.lineNumber}:${start.column},${end.lineNumber}:${end.column}`;

                                            const params = new URLSearchParams(searchParams.toString());
                                            params.set('highlightRange', highlightRange);
                                            router.push(`/${domain}/browse/${file.repository}@${revisionName}/-/blob/${file.fileName}?${params.toString()}`);
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
