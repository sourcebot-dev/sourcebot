'use client';

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useQuery } from "@tanstack/react-query";
import { unwrapServiceError } from "@/lib/utils";
import { FileTreeItem, getFiles } from "@/features/fileTree/actions";
import { useDomain } from "@/hooks/useDomain";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useBrowseNavigation } from "../hooks/useBrowseNavigation";
import { useBrowseState } from "../hooks/useBrowseState";
import { useBrowseParams } from "../hooks/useBrowseParams";
import { FileTreeItemIcon } from "@/features/fileTree/components/fileTreeItemIcon";
import { useLocalStorage } from "usehooks-ts";
import { Skeleton } from "@/components/ui/skeleton";

const MAX_RESULTS = 100;

type SearchResult = {
    file: FileTreeItem;
    match?: {
        from: number;
        to: number;
    };
}

interface FileSearchCommandDialogProps {
    repoName: string;
    revisionName?: string;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSelect: (file: FileTreeItem) => void;
}

export const FileSearchCommandDialog = ({
    repoName,
    revisionName,
    isOpen,
    onOpenChange,
    onSelect: _onSelect,
}: FileSearchCommandDialogProps) => {
    const domain = useDomain();
    const commandListRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const { navigateToPath } = useBrowseNavigation();

    const [recentlyOpened, setRecentlyOpened] = useLocalStorage<FileTreeItem[]>(`recentlyOpenedFiles-${repoName}`, []);

    useHotkeys("mod+p", (event) => {
        event.preventDefault();
        onOpenChange(!isOpen);
    }, {
        enableOnFormTags: true,
        enableOnContentEditable: true,
        description: "Open File Search",
    });

    // Whenever we open the dialog, clear the search query
    useEffect(() => {
        if (isOpen) {
            setSearchQuery('');
        }
    }, [isOpen]);

    const { data: files, isLoading, isError } = useQuery({
        queryKey: ['files', repoName, revisionName, domain],
        queryFn: () => unwrapServiceError(getFiles({ repoName, revisionName: revisionName ?? 'HEAD' }, domain)),
        enabled: isOpen,
    });

    const { filteredFiles, maxResultsHit } = useMemo((): { filteredFiles: SearchResult[]; maxResultsHit: boolean } => {
        if (!files || isLoading) {
            return {
                filteredFiles: [],
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

    const onSelect = useCallback((file: FileTreeItem) => {
        setRecentlyOpened((prev) => {
            const filtered = prev.filter(f => f.path !== file.path);
            return [file, ...filtered];
        });
        onOpenChange(false);
        _onSelect(file);
    }, [setRecentlyOpened, onOpenChange, _onSelect]);

    // @note: We were hitting issues when the user types into the input field while the files are still
    // loading. The workaround was to set `disabled` when loading and then focus the input field when
    // the files are loaded, hence the `useEffect` below.
    useEffect(() => {
        if (!isLoading) {
            inputRef.current?.focus();
        }
    }, [isLoading]);

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(isOpen) => {
                onOpenChange(isOpen);
            }}
            modal={true}
        >
            <DialogContent
                className="overflow-hidden p-0 shadow-lg max-w-[90vw] sm:max-w-2xl top-[20%] translate-y-0"
            >
                <DialogTitle className="sr-only">Search for files</DialogTitle>
                <DialogDescription className="sr-only">{`Search for files in the repository ${repoName}.`}</DialogDescription>
                <Command
                    shouldFilter={false}
                >
                    <CommandInput
                        placeholder={`Search for files in ${repoName}...`}
                        onValueChange={setSearchQuery}
                        disabled={isLoading}
                        ref={inputRef}
                    />
                    {
                        isLoading ? (
                            <ResultsSkeleton />
                        ) : isError ? (
                            <p>Error loading files.</p>
                        ) : (
                            <CommandList ref={commandListRef}>
                                {searchQuery.length === 0 ? (
                                    <CommandGroup
                                        heading="Recently opened"
                                    >
                                        <CommandEmpty className="text-muted-foreground text-center text-sm py-6">No recently opened files.</CommandEmpty>
                                        {recentlyOpened.map((file) => {
                                            return (
                                                <SearchResultComponent
                                                    key={file.path}
                                                    file={file}
                                                    onSelect={() => onSelect(file)}
                                                />
                                            );
                                        })}
                                    </CommandGroup>
                                ) : (
                                    <>
                                        <CommandEmpty className="text-muted-foreground text-center text-sm py-6">No results found.</CommandEmpty>
                                        {filteredFiles.map(({ file, match }) => {
                                            return (
                                                <SearchResultComponent
                                                    key={file.path}
                                                    file={file}
                                                    match={match}
                                                    onSelect={() => onSelect(file)}
                                                />
                                            );
                                        })}
                                        {maxResultsHit && (
                                            <div className="text-muted-foreground text-center text-sm py-4">
                                                Maximum results hit. Please refine your search.
                                            </div>
                                        )}
                                    </>
                                )}
                            </CommandList>
                        )
                    }
                </Command>
            </DialogContent>
        </Dialog>
    )
}

interface SearchResultComponentProps {
    file: FileTreeItem;
    match?: {
        from: number;
        to: number;
    };
    onSelect: () => void;
}

const SearchResultComponent = ({
    file,
    match,
    onSelect,
}: SearchResultComponentProps) => {
    return (
        <CommandItem
            key={file.path}
            onSelect={onSelect}
        >
            <div className="flex flex-row gap-2 w-full cursor-pointer relative">
                <FileTreeItemIcon item={file} className="mt-1" />
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
                    <Skeleton className="w-4 h-4" />
                    <div className="flex flex-col w-full gap-1">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                </div>
            ))}
        </div>
    );
};