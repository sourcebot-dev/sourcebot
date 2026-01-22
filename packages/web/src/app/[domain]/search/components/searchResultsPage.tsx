'use client';

import { CodeSnippet } from "@/app/components/codeSnippet";
import { KeyboardShortcutHint } from "@/app/components/keyboardShortcutHint";
import { useToast } from "@/components/hooks/use-toast";
import { AnimatedResizableHandle } from "@/components/ui/animatedResizableHandle";
import { Button } from "@/components/ui/button";
import {
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RepositoryInfo, SearchResultFile, SearchStats } from "@/features/search";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { useDomain } from "@/hooks/useDomain";
import { useNonEmptyQueryParam } from "@/hooks/useNonEmptyQueryParam";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { SearchQueryParams } from "@/lib/types";
import { createPathWithQueryParams } from "@/lib/utils";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { useLocalStorage } from "@uidotdev/usehooks";
import { AlertTriangleIcon, BugIcon, FilterIcon, RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { ImperativePanelHandle } from "react-resizable-panels";
import { CopyIconButton } from "../../components/copyIconButton";
import { SearchBar } from "../../components/searchBar";
import { TopBar } from "../../components/topBar";
import { useStreamedSearch } from "../useStreamedSearch";
import { CodePreviewPanel } from "./codePreviewPanel";
import { FilterPanel } from "./filterPanel";
import { useFilteredMatches } from "./filterPanel/useFilterMatches";
import { SearchResultsPanel, SearchResultsPanelHandle } from "./searchResultsPanel";
import { ServiceErrorException } from "@/lib/serviceError";

interface SearchResultsPageProps {
    searchQuery: string;
    defaultMaxMatchCount: number;
    isRegexEnabled: boolean;
    isCaseSensitivityEnabled: boolean;
}

export const SearchResultsPage = ({
    searchQuery,
    defaultMaxMatchCount,
    isRegexEnabled,
    isCaseSensitivityEnabled,
}: SearchResultsPageProps) => {
    const router = useRouter();
    const { setSearchHistory } = useSearchHistory();
    const domain = useDomain();
    const { toast } = useToast();
    const captureEvent = useCaptureEvent();

    // Encodes the number of matches to return in the search response.
    const _maxMatchCount = parseInt(useNonEmptyQueryParam(SearchQueryParams.matches) ?? `${defaultMaxMatchCount}`);
    const maxMatchCount = isNaN(_maxMatchCount) ? defaultMaxMatchCount : _maxMatchCount;

    const {
        error,
        files,
        repoInfo,
        timeToSearchCompletionMs,
        timeToFirstSearchResultMs,
        isStreaming,
        numMatches,
        isExhaustive,
        stats,
    } = useStreamedSearch({
        query: searchQuery,
        matches: maxMatchCount,
        contextLines: 3,
        whole: false,
        isRegexEnabled,
        isCaseSensitivityEnabled,
    });

    useEffect(() => {
        if (error) {
            toast({
                description: `❌ Search failed. Reason: ${error instanceof ServiceErrorException ? error.serviceError.message : error.message}`,
            });
        }
    }, [error, toast]);


    // Write the query to the search history
    useEffect(() => {
        if (searchQuery.length === 0) {
            return;
        }

        const now = new Date().toUTCString();
        setSearchHistory((searchHistory) => [
            {
                query: searchQuery,
                date: now,
            },
            ...searchHistory.filter(search => search.query !== searchQuery),
        ])
    }, [searchQuery, setSearchHistory]);

    // Look for any files that are not on the default branch.
    const isBranchFilteringEnabled = useMemo(() => {
        return files.some((file) => {
            return file.branches?.some((branch) => branch !== 'HEAD') ?? false;
        });
    }, [files]);

    useEffect(() => {
        if (isStreaming || !stats) {
            return;
        }

        const fileLanguages = files.map(file => file.language) || [];

        console.debug('timeToFirstSearchResultMs:', timeToFirstSearchResultMs);
        console.debug('timeToSearchCompletionMs:', timeToSearchCompletionMs);

        captureEvent("search_finished", {
            durationMs: timeToSearchCompletionMs,
            timeToSearchCompletionMs,
            timeToFirstSearchResultMs,
            fileCount: stats.fileCount,
            matchCount: stats.totalMatchCount,
            actualMatchCount: stats.actualMatchCount,
            filesSkipped: stats.filesSkipped,
            contentBytesLoaded: stats.contentBytesLoaded,
            indexBytesLoaded: stats.indexBytesLoaded,
            crashes: stats.crashes,
            shardFilesConsidered: stats.shardFilesConsidered,
            filesConsidered: stats.filesConsidered,
            filesLoaded: stats.filesLoaded,
            shardsScanned: stats.shardsScanned,
            shardsSkipped: stats.shardsSkipped,
            shardsSkippedFilter: stats.shardsSkippedFilter,
            ngramMatches: stats.ngramMatches,
            ngramLookups: stats.ngramLookups,
            wait: stats.wait,
            matchTreeConstruction: stats.matchTreeConstruction,
            matchTreeSearch: stats.matchTreeSearch,
            regexpsConsidered: stats.regexpsConsidered,
            flushReason: stats.flushReason,
            fileLanguages,
            isSearchExhaustive: isExhaustive,
            isBranchFilteringEnabled,
        });
    }, [
        captureEvent,
        files,
        isStreaming,
        isExhaustive,
        stats,
        timeToSearchCompletionMs,
        timeToFirstSearchResultMs,
        isBranchFilteringEnabled,
    ]);

    const onLoadMoreResults = useCallback(() => {
        const url = createPathWithQueryParams(`/${domain}/search`,
            [SearchQueryParams.query, searchQuery],
            [SearchQueryParams.matches, `${maxMatchCount * 2}`],
        )
        router.push(url);
    }, [maxMatchCount, router, searchQuery, domain]);

    
    return (
        <div className="flex flex-col h-screen overflow-clip">
            {/* TopBar */}
            <TopBar
                domain={domain}
            >
                <SearchBar
                    size="sm"
                    defaults={{
                        isRegexEnabled,
                        isCaseSensitivityEnabled,
                        query: searchQuery,
                    }}
                    className="w-full"
                />
            </TopBar>

            {error ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                    <AlertTriangleIcon className="h-6 w-6" />
                    <p className="font-semibold text-center">Failed to search</p>
                    <p className="text-sm text-center">{error instanceof ServiceErrorException ? error.serviceError.message : error.message}</p>
                </div>
            ) : (
                <PanelGroup
                    fileMatches={files}
                    onLoadMoreResults={onLoadMoreResults}
                    numMatches={numMatches}
                    repoInfo={repoInfo}
                    searchDurationMs={timeToSearchCompletionMs}
                    isStreaming={isStreaming}
                    searchStats={stats}
                    isMoreResultsButtonVisible={!isExhaustive}
                    isBranchFilteringEnabled={isBranchFilteringEnabled}
                />
            )}
        </div>
    );
}

interface PanelGroupProps {
    fileMatches: SearchResultFile[];
    onLoadMoreResults: () => void;
    isStreaming: boolean;
    isMoreResultsButtonVisible?: boolean;
    isBranchFilteringEnabled: boolean;
    repoInfo: Record<number, RepositoryInfo>;
    searchDurationMs: number;
    numMatches: number;
    searchStats?: SearchStats;
}

const PanelGroup = ({
    fileMatches,
    isMoreResultsButtonVisible,
    isStreaming,
    onLoadMoreResults,
    isBranchFilteringEnabled,
    repoInfo,
    searchDurationMs: _searchDurationMs,
    numMatches,
    searchStats,
}: PanelGroupProps) => {
    const [previewedFile, setPreviewedFile] = useState<SearchResultFile | undefined>(undefined);
    const filteredFileMatches = useFilteredMatches(fileMatches);
    const filterPanelRef = useRef<ImperativePanelHandle>(null);
    const searchResultsPanelRef = useRef<SearchResultsPanelHandle>(null);
    const [selectedMatchIndex, setSelectedMatchIndex] = useState(0);

    const [isFilterPanelCollapsed, setIsFilterPanelCollapsed] = useLocalStorage('isFilterPanelCollapsed', false);

    useHotkeys("mod+b", () => {
        if (isFilterPanelCollapsed) {
            filterPanelRef.current?.expand();
        } else {
            filterPanelRef.current?.collapse();
        }
    }, {
        enableOnFormTags: true,
        enableOnContentEditable: true,
        description: "Toggle filter panel",
    });

    const searchDurationMs = useMemo(() => {
        return Math.round(_searchDurationMs);
    }, [_searchDurationMs]);

    return (
        <ResizablePanelGroup
            direction="horizontal"
            className="h-full"
        >
            {/* ~~ Filter panel ~~ */}
            <ResizablePanel
                ref={filterPanelRef}
                minSize={20}
                maxSize={30}
                defaultSize={isFilterPanelCollapsed ? 0 : 20}
                collapsible={true}
                id={'filter-panel'}
                order={1}
                onCollapse={() => setIsFilterPanelCollapsed(true)}
                onExpand={() => setIsFilterPanelCollapsed(false)}
            >
                <FilterPanel
                    matches={fileMatches}
                    repoInfo={repoInfo}
                    isStreaming={isStreaming}
                    onFilterChange={() => {
                        searchResultsPanelRef.current?.resetScroll();
                    }}
                />
            </ResizablePanel>
            {isFilterPanelCollapsed && (
                <div className="flex flex-col items-center h-full p-2">
                    <Tooltip
                        delayDuration={100}
                    >
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                    filterPanelRef.current?.expand();
                                }}
                            >
                                <FilterIcon className="w-4 h-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="flex flex-row items-center gap-2">
                            <KeyboardShortcutHint shortcut="⌘ B" />
                            <Separator orientation="vertical" className="h-4" />
                            <span>Open filter panel</span>
                        </TooltipContent>
                    </Tooltip>
                </div>
            )}
            <AnimatedResizableHandle />

            {/* ~~ Search results ~~ */}
            <ResizablePanel
                minSize={10}
                id={'search-results-panel'}
                order={2}
            >
                <div className="flex h-full flex-col">
                    <div className="py-1 px-2 flex flex-row items-center">
                        {isStreaming ? (
                            <>
                                <RefreshCwIcon className="h-4 w-4 animate-spin mr-2" />
                                <p className="text-sm font-medium mr-1">Searching...</p>
                                {numMatches > 0 && (
                                    <p className="text-sm font-medium">{`Found ${numMatches} matches in ${fileMatches.length} ${fileMatches.length > 1 ? 'files' : 'file'}`}</p>
                                )}
                            </>
                        ) : (
                            <>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <InfoCircledIcon className="w-4 h-4 mr-2" />
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="flex flex-col items-start gap-2 p-4">
                                        <div className="flex flex-row items-center w-full">
                                            <BugIcon className="w-4 h-4 mr-1.5" />
                                            <p className="text-md font-medium">Search stats for nerds</p>
                                            <CopyIconButton
                                                onCopy={() => {
                                                    navigator.clipboard.writeText(JSON.stringify(searchStats, null, 2));
                                                    return true;
                                                }}
                                                className="ml-auto"
                                            />
                                        </div>
                                        <CodeSnippet renderNewlines>
                                            {JSON.stringify(searchStats, null, 2)}
                                        </CodeSnippet>
                                    </TooltipContent>
                                </Tooltip>
                                {
                                    fileMatches.length > 0 ? (
                                        <p className="text-sm font-medium">{`[${searchDurationMs} ms] Found ${numMatches} matches in ${fileMatches.length} ${fileMatches.length > 1 ? 'files' : 'file'}`}</p>
                                    ) : (
                                        <p className="text-sm font-medium">No results</p>
                                    )
                                }
                                {isMoreResultsButtonVisible && (
                                    <div
                                        className="cursor-pointer text-blue-500 text-sm hover:underline ml-4"
                                        onClick={onLoadMoreResults}
                                    >
                                        (load more)
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <div className="flex-1 min-h-0">
                        {filteredFileMatches.length > 0 ? (
                            <SearchResultsPanel
                                ref={searchResultsPanelRef}
                                fileMatches={filteredFileMatches}
                                onOpenFilePreview={(fileMatch, matchIndex) => {
                                    setSelectedMatchIndex(matchIndex ?? 0);
                                    setPreviewedFile(fileMatch);
                                }}
                                isLoadMoreButtonVisible={!!isMoreResultsButtonVisible}
                                onLoadMoreButtonClicked={onLoadMoreResults}
                                isBranchFilteringEnabled={isBranchFilteringEnabled}
                                repoInfo={repoInfo}
                            />
                        ) : isStreaming ? (
                            <div className="flex flex-col items-center justify-center h-full gap-2">
                                <RefreshCwIcon className="h-6 w-6 animate-spin" />
                                <p className="font-semibold text-center">Searching...</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full">
                                <p className="text-sm text-muted-foreground">No results found</p>
                            </div>
                        )}
                    </div>
                </div>
            </ResizablePanel>

            {previewedFile && (
                <>
                    <AnimatedResizableHandle />
                    {/* ~~ Code preview ~~ */}
                    <ResizablePanel
                        minSize={10}
                        collapsible={true}
                        id={'code-preview-panel'}
                        order={3}
                        onCollapse={() => setPreviewedFile(undefined)}
                    >
                        <CodePreviewPanel
                            previewedFile={previewedFile}
                            onClose={() => setPreviewedFile(undefined)}
                            selectedMatchIndex={selectedMatchIndex}
                            onSelectedMatchIndexChange={setSelectedMatchIndex}
                        />
                    </ResizablePanel>
                </>
            )}
        </ResizablePanelGroup>
    )
}
