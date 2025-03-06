'use client';

import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { useNonEmptyQueryParam } from "@/hooks/useNonEmptyQueryParam";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { Repository, SearchQueryParams, SearchResultFile } from "@/lib/types";
import { createPathWithQueryParams } from "@/lib/utils";
import { SymbolIcon } from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImperativePanelHandle } from "react-resizable-panels";
import { getRepos, search } from "../../api/(client)/client";
import { TopBar } from "../components/topBar";
import { CodePreviewPanel } from "./components/codePreviewPanel";
import { FilterPanel } from "./components/filterPanel";
import { SearchResultsPanel } from "./components/searchResultsPanel";
import { useDomain } from "@/hooks/useDomain";

const DEFAULT_MAX_MATCH_DISPLAY_COUNT = 10000;

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
    const _maxMatchDisplayCount = parseInt(useNonEmptyQueryParam(SearchQueryParams.maxMatchDisplayCount) ?? `${DEFAULT_MAX_MATCH_DISPLAY_COUNT}`);
    const maxMatchDisplayCount = isNaN(_maxMatchDisplayCount) ? DEFAULT_MAX_MATCH_DISPLAY_COUNT : _maxMatchDisplayCount;
    const { setSearchHistory } = useSearchHistory();
    const captureEvent = useCaptureEvent();
    const domain = useDomain();

    const { data: searchResponse, isLoading } = useQuery({
        queryKey: ["search", searchQuery, maxMatchDisplayCount],
        queryFn: () => search({
            query: searchQuery,
            maxMatchDisplayCount,
        }, domain),
        enabled: searchQuery.length > 0,
        refetchOnWindowFocus: false,
    });

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

    // Use the /api/repos endpoint to get a useful list of
    // repository metadata (like host type, repo name, etc.)
    // Convert this into a map of repo name to repo metadata
    // for easy lookup.
    const { data: repoMetadata } = useQuery({
        queryKey: ["repos"],
        queryFn: () => getRepos(domain),
        select: (data): Record<string, Repository> =>
            data.List.Repos
                .map(r => r.Repository)
                .reduce(
                    (acc, repo) => ({
                        ...acc,
                        [repo.Name]: repo,
                    }),
                    {},
                ),
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

    const { fileMatches, searchDurationMs, totalMatchCount, isBranchFilteringEnabled, repoUrlTemplates } = useMemo(() => {
        if (!searchResponse) {
            return {
                fileMatches: [],
                searchDurationMs: 0,
                totalMatchCount: 0,
                isBranchFilteringEnabled: false,
                repoUrlTemplates: {},
            };
        }

        return {
            fileMatches: searchResponse.Result.Files ?? [],
            searchDurationMs: Math.round(searchResponse.Result.Duration / 1000000),
            totalMatchCount: searchResponse.Result.MatchCount,
            isBranchFilteringEnabled: searchResponse.isBranchFilteringEnabled,
            repoUrlTemplates: searchResponse.Result.RepoURLs,
        }
    }, [searchResponse]);

    const isMoreResultsButtonVisible = useMemo(() => {
        return totalMatchCount > maxMatchDisplayCount;
    }, [totalMatchCount, maxMatchDisplayCount]);

    const numMatches = useMemo(() => {
        // Accumualtes the number of matches across all files
        return fileMatches.reduce(
            (acc, file) =>
                acc + file.ChunkMatches.reduce(
                    (acc, chunk) => acc + chunk.Ranges.length,
                    0,
                ),
            0,
        );
    }, [fileMatches]);

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
                <TopBar
                    defaultSearchQuery={searchQuery}
                    domain={domain}
                />
                <Separator />
                {!isLoading && (
                    <div className="bg-accent py-1 px-2 flex flex-row items-center gap-4">
                        {
                            fileMatches.length > 0 ? (
                                <p className="text-sm font-medium">{`[${searchDurationMs} ms] Found ${numMatches} matches in ${fileMatches.length} ${fileMatches.length > 1 ? 'files' : 'file'}`}</p>
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
                    isBranchFilteringEnabled={isBranchFilteringEnabled}
                    repoUrlTemplates={repoUrlTemplates}
                    repoMetadata={repoMetadata ?? {}}
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
    repoUrlTemplates: Record<string, string>;
    repoMetadata: Record<string, Repository>;
}

const PanelGroup = ({
    fileMatches,
    isMoreResultsButtonVisible,
    onLoadMoreResults,
    isBranchFilteringEnabled,
    repoUrlTemplates,
    repoMetadata,
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
                    repoMetadata={repoMetadata}
                />
            </ResizablePanel>
            <ResizableHandle
                className="bg-sidebar-accent w-[2px] transition-colors delay-50 data-[resize-handle-state=drag]:bg-sidebar-accent-foreground data-[resize-handle-state=hover]:bg-sidebar-accent-foreground"
            />

            {/* ~~ Search results ~~ */}
            <ResizablePanel
                minSize={10}
                id={'search-results-panel'}
                order={2}
            >
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
                        repoMetadata={repoMetadata}
                    />
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
                    repoUrlTemplates={repoUrlTemplates}
                />
            </ResizablePanel>
        </ResizablePanelGroup>
    )
}
