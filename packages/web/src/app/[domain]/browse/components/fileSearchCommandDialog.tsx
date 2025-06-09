'use client';

import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useQuery } from "@tanstack/react-query";
import { unwrapServiceError } from "@/lib/utils";
import { FileTreeItem, getFiles } from "@/features/fileTree/actions";
import { useDomain } from "@/hooks/useDomain";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useBrowseNavigation } from "../hooks/useBrowseNavigation";
import { useBrowseState } from "../hooks/useBrowseState";
import { usePrefetchFileSource } from "@/hooks/usePrefetchFileSource";
import { useBrowseParams } from "../hooks/useBrowseParams";
import { FileTreeItemIcon } from "@/features/fileTree/components/fileTreeItemIcon";

const MAX_RESULTS = 100;

type SearchResult = {
    file: FileTreeItem;
    match?: {
        from: number;
        to: number;
    };
}


export const FileSearchCommandDialog = () => {
    const { repoName, revisionName } = useBrowseParams();
    const domain = useDomain();
    const { state: { isFileSearchOpen }, updateBrowseState } = useBrowseState();

    const commandListRef = useRef<HTMLDivElement>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const { navigateToPath } = useBrowseNavigation();
    const { prefetchFileSource } = usePrefetchFileSource();

    const onOpenChange = useCallback((isOpen: boolean) => {
        updateBrowseState({
            isFileSearchOpen: isOpen,
        });

        if (isOpen) {
            setSearchQuery('');
        }
    }, [updateBrowseState]);

    useHotkeys("mod+p", (event) => {
        event.preventDefault();
        onOpenChange(!isFileSearchOpen);
    }, {
        enableOnFormTags: true,
        enableOnContentEditable: true,
        description: "Open File Search",
    });

    const { data: files, isLoading, isError } = useQuery({
        queryKey: ['files', repoName, revisionName, domain],
        queryFn: () => unwrapServiceError(getFiles({ repoName, revisionName: revisionName ?? 'HEAD' }, domain)),
        enabled: isFileSearchOpen,
    });

    const filteredFiles = useMemo((): { filteredFiles: SearchResult[]; maxResultsHit: boolean } => {
        if (!files || isLoading) {
            return {
                filteredFiles: [],
                maxResultsHit: false,
            };
        }

        if (searchQuery.length === 0) {
            return {
                filteredFiles: files.slice(0, MAX_RESULTS).map((file) => ({ file })),
                maxResultsHit: false,
            };
        }

        const matches = files
            .map((file) => {
                return {
                    file,
                    matchIndex: file.path.toLowerCase().indexOf(searchQuery.toLowerCase()),
                }
            })
            .filter(({ matchIndex }) => {
                return matchIndex !== -1;
            });

        return {
            filteredFiles: matches
                .slice(0, MAX_RESULTS)
                .map(({ file, matchIndex }) => {
                    return {
                        file,
                        match: {
                            from: matchIndex,
                            to: matchIndex + searchQuery.length - 1,
                        },
                    }
                }),
            maxResultsHit: matches.length > MAX_RESULTS,
        }
    }, [searchQuery, files, isLoading]);

    // Scroll to the top of the list whenever the search query changes
    useEffect(() => {
        commandListRef.current?.scrollTo({
            top: 0,
        })
    }, [searchQuery]);

    return (
        <Dialog
            open={isFileSearchOpen}
            onOpenChange={onOpenChange}
            modal={true}
        >
            <DialogContent
                className="overflow-hidden p-0 shadow-lg max-w-[90vw] sm:max-w-2xl"
            >
                <DialogTitle className="sr-only">Search for files</DialogTitle>
                <DialogDescription className="sr-only">{`Search for files in the repository ${repoName}.`}</DialogDescription>
                <Command
                    shouldFilter={false}
                >
                    <CommandInput
                        placeholder={`Search for files in ${repoName}...`}
                        onValueChange={setSearchQuery}
                    />
                    {
                        isLoading ? (
                            <ResultsSkeleton />
                        ) : isError ? (
                            <p>Error loading files.</p>
                        ) : (
                            <CommandList ref={commandListRef}>
                                <CommandEmpty className="text-muted-foreground text-center text-sm py-6">No results found.</CommandEmpty>
                                {filteredFiles.filteredFiles.map(({ file, match }) => {
                                    return (
                                        <CommandItem
                                            key={file.path}
                                            onSelect={() => {
                                                navigateToPath({
                                                    repoName,
                                                    revisionName,
                                                    path: file.path,
                                                    pathType: 'blob',
                                                });
                                                onOpenChange(false);
                                            }}
                                            onMouseEnter={() => {
                                                prefetchFileSource(
                                                    repoName,
                                                    revisionName ?? 'HEAD',
                                                    file.path
                                                );
                                            }}
                                        >
                                            <div className="flex flex-row gap-2 w-full cursor-pointer">
                                                <FileTreeItemIcon item={file} className="mt-0.5" />
                                                <div className="flex flex-col w-full">
                                                    <span className="text-sm font-medium">
                                                        {file.name}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {match ? (
                                                            <Highlight text={file.path} range={match} />
                                                        ) : (
                                                            file.path
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </CommandItem>
                                    );
                                })}
                                {filteredFiles.maxResultsHit && (
                                    <div className="text-muted-foreground text-center text-sm py-4">
                                        Maximum results hit. Please refine your search.
                                    </div>
                                )}
                            </CommandList>
                        )
                    }
                </Command>
            </DialogContent>
        </Dialog>
    )
}

const Highlight = ({ text, range }: { text: string, range: { from: number; to: number } }) => {
    return (
        <span>
            {text.slice(0, range.from)}
            <span className="searchMatch-selected">{text.slice(range.from, range.to + 1)}</span>
            {text.slice(range.to + 1)}
        </span>
    )
}

const ResultsSkeleton = () => {
    return (
        <div className="p-2">
            {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex flex-row gap-2 p-2 mb-1">
                    <div className="w-4 h-4 bg-gray-200 rounded mt-0.5 animate-pulse" />
                    <div className="flex flex-col w-full gap-1">
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-1/4" />
                        <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
                    </div>
                </div>
            ))}
        </div>
    );
};