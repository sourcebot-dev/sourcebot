'use client';

import {
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { useNonEmptyQueryParam } from "@/hooks/useNonEmptyQueryParam";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { SearchQueryParams } from "@/lib/types";
import { createPathWithQueryParams, measure, unwrapServiceError } from "@/lib/utils";
import { InfoCircledIcon, SymbolIcon } from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { search } from "../../api/(client)/client";
import { TopBar } from "../components/topBar";
import { CodePreviewPanel } from "./components/codePreviewPanel";
import { FilterPanel } from "./components/filterPanel";
import { SearchResultsPanel } from "./components/searchResultsPanel";
import { useDomain } from "@/hooks/useDomain";
import { useToast } from "@/components/hooks/use-toast";
import { RepositoryInfo, SearchResultFile } from "@/features/search/types";
import { AnimatedResizableHandle } from "@/components/ui/animatedResizableHandle";
import { useFilteredMatches } from "./components/filterPanel/useFilterMatches";
import { Button } from "@/components/ui/button";
import { ImperativePanelHandle } from "react-resizable-panels";
import { FilterIcon } from "lucide-react";
import { useHotkeys } from "react-hotkeys-hook";
import { useLocalStorage } from "@uidotdev/usehooks";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { KeyboardShortcutHint } from "@/app/components/keyboardShortcutHint";
import { SearchBar } from "../components/searchBar";

const DEFAULT_MAX_MATCH_COUNT = 10000;

export default function SearchPage() {
    // We need a suspense boundary here since we are accessing query params
    // in the top level page.
    // @see : https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
    return (
        <Suspense>
            <SearchPageInternal />
        </Suspense>
    )
}

const SearchPageInternal = () => {
    const router = useRouter();
    const searchQuery = useNonEmptyQueryParam(SearchQueryParams.query) ?? "";
    const { setSearchHistory } = useSearchHistory();
    const captureEvent = useCaptureEvent();
    const domain = useDomain();
    const { toast } = useToast();

    // Encodes the number of matches to return in the search response.
    const _maxMatchCount = parseInt(useNonEmptyQueryParam(SearchQueryParams.matches) ?? `${DEFAULT_MAX_MATCH_COUNT}`);
    const maxMatchCount = isNaN(_maxMatchCount) ? DEFAULT_MAX_MATCH_COUNT : _maxMatchCount;

    const { data: searchResponse, isLoading: isSearchLoading, error } = useQuery({
        queryKey: ["search", searchQuery, maxMatchCount],
        queryFn: () => measure(() => unwrapServiceError(search({
            query: searchQuery,
            matches: maxMatchCount,
            contextLines: 3,
            whole: false,
        }, domain)), "client.search"),
        select: ({ data, durationMs }) => ({
            ...data,
            durationMs,
        }),
        enabled: searchQuery.length > 0,
        refetchOnWindowFocus: false,
        retry: false,
        staleTime: Infinity,
    });

    useEffect(() => {
        if (error) {
            toast({
                description: `❌ Search failed. Reason: ${error.message}`,
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

    useEffect(() => {
        if (!searchResponse) {
            return;
        }

        const fileLanguages = searchResponse.files?.map(file => file.language) || [];

        captureEvent("search_finished", {
            durationMs: searchResponse.durationMs,
            fileCount: searchResponse.zoektStats.fileCount,
            matchCount: searchResponse.zoektStats.matchCount,
            filesSkipped: searchResponse.zoektStats.filesSkipped,
            contentBytesLoaded: searchResponse.zoektStats.contentBytesLoaded,
            indexBytesLoaded: searchResponse.zoektStats.indexBytesLoaded,
            crashes: searchResponse.zoektStats.crashes,
            shardFilesConsidered: searchResponse.zoektStats.shardFilesConsidered,
            filesConsidered: searchResponse.zoektStats.filesConsidered,
            filesLoaded: searchResponse.zoektStats.filesLoaded,
            shardsScanned: searchResponse.zoektStats.shardsScanned,
            shardsSkipped: searchResponse.zoektStats.shardsSkipped,
            shardsSkippedFilter: searchResponse.zoektStats.shardsSkippedFilter,
            ngramMatches: searchResponse.zoektStats.ngramMatches,
            ngramLookups: searchResponse.zoektStats.ngramLookups,
            wait: searchResponse.zoektStats.wait,
            matchTreeConstruction: searchResponse.zoektStats.matchTreeConstruction,
            matchTreeSearch: searchResponse.zoektStats.matchTreeSearch,
            regexpsConsidered: searchResponse.zoektStats.regexpsConsidered,
            flushReason: searchResponse.zoektStats.flushReason,
            fileLanguages,
        });
    }, [captureEvent, searchQuery, searchResponse]);

    const { fileMatches, searchDurationMs, totalMatchCount, isBranchFilteringEnabled, repositoryInfo, matchCount } = useMemo(() => {
        if (!searchResponse) {
            return {
                fileMatches: [],
                searchDurationMs: 0,
                totalMatchCount: 0,
                isBranchFilteringEnabled: false,
                repositoryInfo: {},
                matchCount: 0,
            };
        }

        return {
            fileMatches: searchResponse.files ?? [],
            searchDurationMs: Math.round(searchResponse.durationMs),
            totalMatchCount: searchResponse.zoektStats.matchCount,
            isBranchFilteringEnabled: searchResponse.isBranchFilteringEnabled,
            repositoryInfo: searchResponse.repositoryInfo.reduce((acc, repo) => {
                acc[repo.id] = repo;
                return acc;
            }, {} as Record<number, RepositoryInfo>),
            matchCount: searchResponse.stats.matchCount,
        }
    }, [searchResponse]);

    const isMoreResultsButtonVisible = useMemo(() => {
        return totalMatchCount > maxMatchCount;
    }, [totalMatchCount, maxMatchCount]);

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
                    defaultQuery={searchQuery}
                    className="w-full"
                />
            </TopBar>

            {(isSearchLoading) ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                    <SymbolIcon className="h-6 w-6 animate-spin" />
                    <p className="font-semibold text-center">Searching...</p>
                </div>
            ) : (
                <PanelGroup
                    fileMatches={fileMatches}
                    isMoreResultsButtonVisible={isMoreResultsButtonVisible}
                    onLoadMoreResults={onLoadMoreResults}
                    isBranchFilteringEnabled={isBranchFilteringEnabled}
                    repoInfo={repositoryInfo}
                    searchDurationMs={searchDurationMs}
                    numMatches={matchCount}
                />
            )}
        </div>
    );
}

interface PanelGroupProps {
    fileMatches: SearchResultFile[];
    isMoreResultsButtonVisible?: boolean;
    onLoadMoreResults: () => void;
    isBranchFilteringEnabled: boolean;
    repoInfo: Record<number, RepositoryInfo>;
    searchDurationMs: number;
    numMatches: number;
}

const PanelGroup = ({
    fileMatches,
    isMoreResultsButtonVisible,
    onLoadMoreResults,
    isBranchFilteringEnabled,
    repoInfo,
    searchDurationMs,
    numMatches,
}: PanelGroupProps) => {
    const [previewedFile, setPreviewedFile] = useState<SearchResultFile | undefined>(undefined);
    const filteredFileMatches = useFilteredMatches(fileMatches);
    const filterPanelRef = useRef<ImperativePanelHandle>(null);
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
                <div className="py-1 px-2 flex flex-row items-center">
                    <InfoCircledIcon className="w-4 h-4 mr-2" />
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
                </div>
                {filteredFileMatches.length > 0 ? (
                    <SearchResultsPanel
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
                ) : (
                    <div className="flex flex-col items-center justify-center h-full">
                        <p className="text-sm text-muted-foreground">No results found</p>
                    </div>
                )}
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
