'use client';

import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { useNonEmptyQueryParam } from "@/hooks/useNonEmptyQueryParam";
import { SearchQueryParams, SearchResultFile } from "@/lib/types";
import { createPathWithQueryParams } from "@/lib/utils";
import { SymbolIcon } from "@radix-ui/react-icons";
import { Scrollbar } from "@radix-ui/react-scroll-area";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import logoDark from "../../../public/sb_logo_dark.png";
import logoLight from "../../../public/sb_logo_light.png";
import { search } from "../api/(client)/client";
import { SearchBar } from "../searchBar";
import { SettingsDropdown } from "../settingsDropdown";
import { CodePreviewPanel } from "./components/codePreviewPanel";
import { FilterPanel } from "./components/filterPanel";
import { SearchResultsPanel } from "./components/searchResultsPanel";
import { ImperativePanelHandle } from "react-resizable-panels";

const DEFAULT_MAX_MATCH_DISPLAY_COUNT = 200;

export default function SearchPage() {
    const router = useRouter();
    const searchQuery = useNonEmptyQueryParam(SearchQueryParams.query) ?? "";
    const _maxMatchDisplayCount = parseInt(useNonEmptyQueryParam(SearchQueryParams.maxMatchDisplayCount) ?? `${DEFAULT_MAX_MATCH_DISPLAY_COUNT}`);
    const maxMatchDisplayCount = isNaN(_maxMatchDisplayCount) ? DEFAULT_MAX_MATCH_DISPLAY_COUNT : _maxMatchDisplayCount;

    const captureEvent = useCaptureEvent();

    const { data: searchResponse, isLoading } = useQuery({
        queryKey: ["search", searchQuery, maxMatchDisplayCount],
        queryFn: () => search({
            query: searchQuery,
            maxMatchDisplayCount,
        }),
        enabled: searchQuery.length > 0,
        refetchOnWindowFocus: false,
    });

    useEffect(() => {
        if (!searchResponse) {
            return;
        }

        const fileLanguages = searchResponse.Result.Files?.map(file => file.Language) || [];

        captureEvent("search_finished", {
            contentBytesLoaded: searchResponse.Result.ContentBytesLoaded,
            indexBytesLoaded: searchResponse.Result.IndexBytesLoaded,
            crashes: searchResponse.Result.Crashes,
            durationMs: searchResponse.Result.Duration / 1000000,
            fileCount: searchResponse.Result.FileCount,
            shardFilesConsidered: searchResponse.Result.ShardFilesConsidered,
            filesConsidered: searchResponse.Result.FilesConsidered,
            filesLoaded: searchResponse.Result.FilesLoaded,
            filesSkipped: searchResponse.Result.FilesSkipped,
            shardsScanned: searchResponse.Result.ShardsScanned,
            shardsSkipped: searchResponse.Result.ShardsSkipped,
            shardsSkippedFilter: searchResponse.Result.ShardsSkippedFilter,
            matchCount: searchResponse.Result.MatchCount,
            ngramMatches: searchResponse.Result.NgramMatches,
            ngramLookups: searchResponse.Result.NgramLookups,
            wait: searchResponse.Result.Wait,
            matchTreeConstruction: searchResponse.Result.MatchTreeConstruction,
            matchTreeSearch: searchResponse.Result.MatchTreeSearch,
            regexpsConsidered: searchResponse.Result.RegexpsConsidered,
            flushReason: searchResponse.Result.FlushReason,
            fileLanguages,
        });
    }, [captureEvent, searchResponse]);

    const { fileMatches, searchDurationMs } = useMemo((): { fileMatches: SearchResultFile[], searchDurationMs: number } => {
        if (!searchResponse) {
            return {
                fileMatches: [],
                searchDurationMs: 0,
            };
        }

        return {
            fileMatches: searchResponse.Result.Files ?? [],
            searchDurationMs: Math.round(searchResponse.Result.Duration / 1000000),
        }
    }, [searchResponse]);

    const isMoreResultsButtonVisible = useMemo(() => {
        return searchResponse && searchResponse.Result.MatchCount > maxMatchDisplayCount;
    }, [searchResponse, maxMatchDisplayCount]);

    const numMatches = useMemo(() => {
        // Accumualtes the number of matches across all files
        return searchResponse?.Result.Files?.reduce(
            (acc, file) =>
                acc + file.ChunkMatches.reduce(
                    (acc, chunk) => acc + chunk.Ranges.length,
                    0,
                ),
            0,
        ) ?? 0;
    }, [searchResponse]);

    const onLoadMoreResults = useCallback(() => {
        const url = createPathWithQueryParams('/search',
            [SearchQueryParams.query, searchQuery],
            [SearchQueryParams.maxMatchDisplayCount, `${maxMatchDisplayCount * 2}`],
        )
        router.push(url);
    }, [maxMatchDisplayCount, router, searchQuery]);

    return (
        <div className="flex flex-col h-screen overflow-clip">
            {/* TopBar */}
            <div className="sticky top-0 left-0 right-0 z-10">
                <div className="flex flex-row justify-between items-center py-1.5 px-3 gap-4">
                    <div className="grow flex flex-row gap-4 items-center">
                        <div
                            className="shrink-0 cursor-pointer"
                            onClick={() => {
                                router.push("/");
                            }}
                        >
                            <Image
                                src={logoDark}
                                className="h-4 w-auto hidden dark:block"
                                alt={"Sourcebot logo"}
                            />
                            <Image
                                src={logoLight}
                                className="h-4 w-auto block dark:hidden"
                                alt={"Sourcebot logo"}
                            />
                        </div>
                        <SearchBar
                            size="sm"
                            defaultQuery={searchQuery}
                        />
                    </div>
                    <SettingsDropdown
                        menuButtonClassName="w-8 h-8"
                    />
                </div>
                <Separator />
                {!isLoading && (
                    <div className="bg-accent py-1 px-2 flex flex-row items-center gap-4">
                        {
                            fileMatches.length > 0 && searchResponse ? (
                                <p className="text-sm font-medium">{`[${searchDurationMs} ms] Displaying ${numMatches} of ${searchResponse.Result.MatchCount} matches in ${fileMatches.length} ${fileMatches.length > 1 ? 'files' : 'file'}`}</p>
                            ) : (
                                <p className="text-sm font-medium">No results</p>
                            )
                        }
                        {isMoreResultsButtonVisible && (
                            <div
                                className="cursor-pointer text-blue-500 text-sm hover:underline"
                                onClick={onLoadMoreResults}
                            >
                                (load more)
                            </div>
                        )}
                    </div>
                )}
                <Separator />
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                    <SymbolIcon className="h-6 w-6 animate-spin" />
                    <p className="font-semibold text-center">Searching...</p>
                </div>
            ) : (
                <PanelGroup
                    fileMatches={fileMatches}
                    isMoreResultsButtonVisible={isMoreResultsButtonVisible}
                    onLoadMoreResults={onLoadMoreResults}
                />
            )}
        </div>
    );
}

interface PanelGroupProps {
    fileMatches: SearchResultFile[];
    isMoreResultsButtonVisible?: boolean;
    onLoadMoreResults: () => void;
}

const PanelGroup = ({
    fileMatches,
    isMoreResultsButtonVisible,
    onLoadMoreResults,
}: PanelGroupProps) => {
    const [selectedMatchIndex, setSelectedMatchIndex] = useState(0);
    const [selectedFile, setSelectedFile] = useState<SearchResultFile | undefined>(undefined);

    const codePreviewPanelRef = useRef<ImperativePanelHandle>(null);
    useEffect(() => {
        if (selectedFile) {
            codePreviewPanelRef.current?.expand();
        } else {
            codePreviewPanelRef.current?.collapse();
        }
    }, [selectedFile]);

    return (
        <ResizablePanelGroup
            direction="horizontal"
        >
            {/* ~~ Filter panel ~~ */}
            <ResizablePanel
                minSize={20}
                maxSize={30}
                defaultSize={20}
                collapsible={true}
                id={'filter-panel'}
                order={1}
            >
                <FilterPanel
                    fileMatches={fileMatches}
                />
            </ResizablePanel>
            <ResizableHandle
                className="bg-accent w-1 transition-colors delay-50 data-[resize-handle-state=drag]:bg-accent-foreground data-[resize-handle-state=hover]:bg-accent-foreground"
            />

            {/* ~~ Search results ~~ */}
            <ResizablePanel
                minSize={10}
                id={'search-results-panel'}
                order={2}
            >
                {fileMatches.length > 0 ? (
                    <ScrollArea
                        className="h-full"
                    >
                        <SearchResultsPanel
                            fileMatches={fileMatches}
                            onOpenFileMatch={(fileMatch) => {
                                setSelectedFile(fileMatch);
                            }}
                            onMatchIndexChanged={(matchIndex) => {
                                setSelectedMatchIndex(matchIndex);
                            }}
                        />
                        {isMoreResultsButtonVisible && (
                            <div className="p-3">
                                <span
                                    className="cursor-pointer text-blue-500 hover:underline"
                                    onClick={onLoadMoreResults}
                                >
                                    Load more results
                                </span>
                            </div>
                        )}
                        <Scrollbar orientation="vertical" />
                    </ScrollArea>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full">
                        <p className="text-sm text-muted-foreground">No results found</p>
                    </div>
                )}
            </ResizablePanel>
            <ResizableHandle
                withHandle={selectedFile !== undefined}
            />

            {/* ~~ Code preview ~~ */}
            <ResizablePanel
                ref={codePreviewPanelRef}
                minSize={10}
                collapsible={true}
                id={'code-preview-panel'}
                order={3}
            >
                <CodePreviewPanel
                    fileMatch={selectedFile}
                    onClose={() => setSelectedFile(undefined)}
                    selectedMatchIndex={selectedMatchIndex}
                    onSelectedMatchIndexChange={setSelectedMatchIndex}
                />
            </ResizablePanel>
        </ResizablePanelGroup>
    )
}