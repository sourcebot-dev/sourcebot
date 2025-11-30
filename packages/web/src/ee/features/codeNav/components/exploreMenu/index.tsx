'use client';

import { useBrowseState } from "@/app/[domain]/browse/hooks/useBrowseState";
import { findSearchBasedSymbolDefinitions, findSearchBasedSymbolReferences } from "@/app/api/(client)/client";
import { AnimatedResizableHandle } from "@/components/ui/animatedResizableHandle";
import { Badge } from "@/components/ui/badge";
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDomain } from "@/hooks/useDomain";
import { unwrapServiceError } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { GlobeIcon, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { VscSymbolMisc } from "react-icons/vsc";
import { ReferenceList } from "./referenceList";
import { KeyboardShortcutHint } from "@/app/components/keyboardShortcutHint";
import { useHotkeys } from "react-hotkeys-hook";

interface ExploreMenuProps {
    selectedSymbolInfo: {
        symbolName: string;
        repoName: string;
        revisionName: string;
        language: string;
    }
}

export const ExploreMenu = ({
    selectedSymbolInfo,
}: ExploreMenuProps) => {

    const domain = useDomain();
    const {
        state: { activeExploreMenuTab },
        updateBrowseState,
    } = useBrowseState();

    const [isGlobalSearchEnabled, setIsGlobalSearchEnabled] = useState(false);

    const {
        data: referencesResponse,
        isError: isReferencesResponseError,
        isPending: isReferencesResponsePending,
        isLoading: isReferencesResponseLoading,
    } = useQuery({
        queryKey: ["references", selectedSymbolInfo.symbolName, selectedSymbolInfo.repoName, selectedSymbolInfo.revisionName, selectedSymbolInfo.language, domain, isGlobalSearchEnabled],
        queryFn: () => unwrapServiceError(
            findSearchBasedSymbolReferences({
                symbolName: selectedSymbolInfo.symbolName,
                language: selectedSymbolInfo.language,
                revisionName: selectedSymbolInfo.revisionName,
                repoName: isGlobalSearchEnabled ? undefined : selectedSymbolInfo.repoName
            })
        ),
    });

    const {
        data: definitionsResponse,
        isError: isDefinitionsResponseError,
        isPending: isDefinitionsResponsePending,
        isLoading: isDefinitionsResponseLoading,
    } = useQuery({
        queryKey: ["definitions", selectedSymbolInfo.symbolName, selectedSymbolInfo.repoName, selectedSymbolInfo.revisionName, selectedSymbolInfo.language, domain, isGlobalSearchEnabled],
        queryFn: () => unwrapServiceError(
            findSearchBasedSymbolDefinitions({
                symbolName: selectedSymbolInfo.symbolName,
                language: selectedSymbolInfo.language,
                revisionName: selectedSymbolInfo.revisionName,
                repoName: isGlobalSearchEnabled ? undefined : selectedSymbolInfo.repoName
            })
        ),
    });

    useHotkeys('shift+a', () => {
        setIsGlobalSearchEnabled(!isGlobalSearchEnabled);
    }, {
        enableOnFormTags: true,
        enableOnContentEditable: true,
        description: "Search all repositories",
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
                className="flex flex-col h-full"
            >
                <div className="flex flex-col p-2">
                    <div className="flex flex-row items-center justify-between">

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
                                align="center"
                            >
                                Symbol references and definitions found using a best-guess search heuristic.
                            </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span>
                                    <Toggle
                                        pressed={isGlobalSearchEnabled}
                                        onPressedChange={setIsGlobalSearchEnabled}
                                    >
                                        <GlobeIcon className="w-4 h-4" />
                                    </Toggle>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="center">
                                {isGlobalSearchEnabled ? "Search in current repository only" : "Search all repositories"}
                                <KeyboardShortcutHint
                                    shortcut="⇧ A"
                                    className="ml-2"
                                />
                            </TooltipContent>
                        </Tooltip>
                    </div>
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
            <AnimatedResizableHandle />
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
