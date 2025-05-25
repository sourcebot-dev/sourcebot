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
import { ImperativePanelHandle } from "react-resizable-panels";
import { search } from "../../api/(client)/client";
import { TopBar } from "../components/topBar";
import { CodePreviewPanel } from "./components/codePreviewPanel";
import { FilterPanel } from "./components/filterPanel";
import { SearchResultsPanel } from "./components/searchResultsPanel";
import { useDomain } from "@/hooks/useDomain";
import { useToast } from "@/components/hooks/use-toast";
import { RepositoryInfo, SearchResultFile } from "@/features/search/types";
import { AnimatedResizableHandle } from "@/components/ui/animatedResizableHandle";

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
            <div className="sticky top-0 left-0 right-0 z-10">
                <TopBar
                    defaultSearchQuery={searchQuery}
                    domain={domain}
                />
                <Separator />
            </div>

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
    const [selectedMatchIndex, setSelectedMatchIndex] = useState(0);
    const [selectedFile, setSelectedFile] = useState<SearchResultFile | undefined>(undefined);
    const [filteredFileMatches, setFilteredFileMatches] = useState<SearchResultFile[]>(fileMatches);

    const codePreviewPanelRef = useRef<ImperativePanelHandle>(null);
    useEffect(() => {
        if (selectedFile) {
            codePreviewPanelRef.current?.expand();
        } else {
            codePreviewPanelRef.current?.collapse();
        }
    }, [selectedFile]);

    const onFilterChanged = useCallback((matches: SearchResultFile[]) => {
        setFilteredFileMatches(matches);
    }, []);

    return (
        <ResizablePanelGroup
            direction="horizontal"
            className="h-full"
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
                    matches={fileMatches}
                    onFilterChanged={onFilterChanged}
                    repoInfo={repoInfo}
                />
            </ResizablePanel>
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
                        onOpenFileMatch={(fileMatch) => {
                            setSelectedFile(fileMatch);
                        }}
                        onMatchIndexChanged={(matchIndex) => {
                            setSelectedMatchIndex(matchIndex);
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
            <AnimatedResizableHandle />

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
