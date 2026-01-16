// Adapted from: web/src/components/ui/multi-select.tsx

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { RepositoryQuery, SearchContextQuery } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
    CheckIcon,
    ChevronDown,
    ScanSearchIcon,
} from "lucide-react";
import { ButtonHTMLAttributes, forwardRef, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { RepoSearchScope, RepoSetSearchScope, SearchScope } from "../../types";
import { SearchScopeIcon } from "../searchScopeIcon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SearchScopeInfoCard } from "./searchScopeInfoCard";

interface SearchScopeSelectorProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    repos: RepositoryQuery[];
    searchContexts: SearchContextQuery[];
    selectedSearchScopes: SearchScope[];
    onSelectedSearchScopesChange: (items: SearchScope[]) => void;
    className?: string;
    isOpen: boolean;
    onOpenChanged: (isOpen: boolean) => void;
}

export const SearchScopeSelector = forwardRef<
    HTMLButtonElement,
    SearchScopeSelectorProps
>(
    (
        {
            repos,
            searchContexts,
            className,
            selectedSearchScopes,
            onSelectedSearchScopesChange,
            isOpen,
            onOpenChanged,
            ...props
        },
        ref
    ) => {
        const scrollContainerRef = useRef<HTMLDivElement>(null);
        const scrollPosition = useRef<number>(0);
        const [searchQuery, setSearchQuery] = useState("");
        const [isMounted, setIsMounted] = useState(false);
        const [highlightedIndex, setHighlightedIndex] = useState<number>(0);

        const toggleItem = useCallback((item: SearchScope) => {
            // Store current scroll position before state update
            if (scrollContainerRef.current) {
                scrollPosition.current = scrollContainerRef.current.scrollTop;
            }

            const isSelected = selectedSearchScopes.some(
                (selected) => selected.type === item.type && selected.value === item.value
            );

            const newSelectedItems = isSelected ?
                selectedSearchScopes.filter(
                    (selected) => !(selected.type === item.type && selected.value === item.value)
                ) :
                [...selectedSearchScopes, item];

            onSelectedSearchScopesChange(newSelectedItems);
        }, [selectedSearchScopes, onSelectedSearchScopesChange]);

        const allSearchScopeItems = useMemo(() => {
            const repoSetSearchScopeItems: RepoSetSearchScope[] = searchContexts.map(context => ({
                type: 'reposet' as const,
                value: context.name,
                name: context.name,
                repoCount: context.repoNames.length
            }));

            const repoSearchScopeItems: RepoSearchScope[] = repos.map(repo => ({
                type: 'repo' as const,
                value: repo.repoName,
                name: repo.repoDisplayName || repo.repoName.split('/').pop() || repo.repoName,
                codeHostType: repo.codeHostType,
            }));

            return [...repoSetSearchScopeItems, ...repoSearchScopeItems];
        }, [repos, searchContexts]);

        const handleClear = useCallback(() => {
            onSelectedSearchScopesChange([]);
            setSearchQuery("");
            requestAnimationFrame(() => {
                if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollTop = 0;
                }
            })
        }, [onSelectedSearchScopesChange]);

        const handleSelectAll = useCallback(() => {
            onSelectedSearchScopesChange(allSearchScopeItems);
            requestAnimationFrame(() => {
                if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollTop = 0;
                }
            });
        }, [onSelectedSearchScopesChange, allSearchScopeItems]);

        const handleTogglePopover = useCallback(() => {
            onOpenChanged(!isOpen);
        }, [onOpenChanged, isOpen]);

        const sortedSearchScopeItems = useMemo(() => {
            const query = searchQuery.toLowerCase();

            return allSearchScopeItems
                .filter((item) => {
                    // Filter by search query
                    if (query && !item.name.toLowerCase().includes(query) && !item.value.toLowerCase().includes(query)) {
                        return false;
                    }
                    return true;
                })
                .map((item) => ({
                    item,
                    isSelected: selectedSearchScopes.some(
                        (selected) => selected.type === item.type && selected.value === item.value
                    )
                }))
                .sort((a, b) => {
                    // Selected items first
                    if (a.isSelected && !b.isSelected) return -1;
                    if (!a.isSelected && b.isSelected) return 1;
                    // Then reposets before repos
                    if (a.item.type === 'reposet' && b.item.type === 'repo') return -1;
                    if (a.item.type === 'repo' && b.item.type === 'reposet') return 1;
                    return 0;
                })
        }, [allSearchScopeItems, selectedSearchScopes, searchQuery]);

        const handleInputKeyDown = useCallback(
            (event: KeyboardEvent<HTMLInputElement>) => {
                if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setHighlightedIndex((prev) =>
                        prev < sortedSearchScopeItems.length - 1 ? prev + 1 : prev
                    );
                } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setHighlightedIndex((prev) => prev > 0 ? prev - 1 : 0);
                } else if (event.key === "Enter") {
                    event.preventDefault();
                    if (sortedSearchScopeItems.length > 0 && highlightedIndex >= 0) {
                        toggleItem(sortedSearchScopeItems[highlightedIndex].item);
                    }
                } else if (event.key === "Backspace" && !event.currentTarget.value) {
                    const newSelectedItems = [...selectedSearchScopes];
                    newSelectedItems.pop();
                    onSelectedSearchScopesChange(newSelectedItems);
                }
            }, [highlightedIndex, onSelectedSearchScopesChange, selectedSearchScopes, sortedSearchScopeItems, toggleItem]);

        const virtualizer = useVirtualizer({
            count: sortedSearchScopeItems.length,
            getScrollElement: () => scrollContainerRef.current,
            estimateSize: () => 36,
            overscan: 5,
        });

        // Reset highlighted index and scroll to top when search query changes
        useEffect(() => {
            setHighlightedIndex(0);
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = 0;
            }
        }, [searchQuery]);

        // Reset highlighted index when items change (but don't scroll)
        useEffect(() => {
            setHighlightedIndex(0);
        }, [sortedSearchScopeItems.length]);

        // Measure virtualizer when popover opens and container is mounted
        useEffect(() => {
            if (isOpen) {
                setIsMounted(true);
                setHighlightedIndex(0);
                // Give the DOM a tick to render before measuring
                requestAnimationFrame(() => {
                    if (scrollContainerRef.current) {
                        virtualizer.measure();
                    }
                });
            } else {
                setIsMounted(false);
            }
        }, [isOpen, virtualizer]);

        // Scroll highlighted item into view
        useEffect(() => {
            if (isMounted && highlightedIndex >= 0) {
                virtualizer.scrollToIndex(highlightedIndex, {
                    align: 'auto',
                });
            }
        }, [highlightedIndex, isMounted, virtualizer]);

        // Restore scroll position after re-render
        useEffect(() => {
            if (scrollContainerRef.current && scrollPosition.current > 0) {
                scrollContainerRef.current.scrollTop = scrollPosition.current;
            }
        }, [sortedSearchScopeItems]);

        return (
            <Popover
                open={isOpen}
                onOpenChange={onOpenChanged}
            >
                <Tooltip>
                    <PopoverTrigger asChild>
                        <TooltipTrigger asChild>
                            <Button
                                ref={ref}
                                {...props}
                                onClick={handleTogglePopover}
                                className={cn(
                                    "flex p-1 rounded-md items-center justify-between bg-inherit h-6",
                                    className
                                )}
                            >
                                <div className="flex items-center justify-between w-full mx-auto">
                                    <ScanSearchIcon className="h-4 w-4 text-muted-foreground mr-1" />
                                    <span
                                        className={cn("text-sm text-muted-foreground mx-1 font-medium")}
                                    >
                                        {
                                            selectedSearchScopes.length === 0 ? `Search scopes` :
                                                selectedSearchScopes.length === 1 ? selectedSearchScopes[0].name :
                                                    `${selectedSearchScopes.length} selected`
                                        }
                                    </span>
                                    <ChevronDown className="h-4 cursor-pointer text-muted-foreground" />
                                </div>
                            </Button>
                        </TooltipTrigger>
                    </PopoverTrigger>
                    <TooltipContent side="bottom" className="p-0 border-0 bg-transparent shadow-none">
                        <SearchScopeInfoCard />
                    </TooltipContent>
                    <PopoverContent
                        className="w-[400px] p-0"
                        align="start"
                        onEscapeKeyDown={() => onOpenChanged(false)}
                    >
                        <div className="flex flex-col">
                            <div className="flex items-center border-b px-3">
                                <Input
                                    placeholder="Search scopes..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={handleInputKeyDown}
                                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-11"
                                />
                            </div>
                            <div
                                ref={scrollContainerRef}
                                className="max-h-[300px] overflow-auto"
                            >
                                {sortedSearchScopeItems.length === 0 ? (
                                    <div className="py-6 text-center text-sm text-muted-foreground">
                                        No results found.
                                    </div>
                                ) : (
                                    <div className="p-1">
                                        {!searchQuery && (
                                            <div
                                                onClick={handleSelectAll}
                                                className="flex items-center px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors rounded-sm hover:bg-accent"
                                            >
                                                <span className="text-xs">Select all</span>
                                            </div>
                                        )}
                                        <div
                                            style={{
                                                height: `${virtualizer.getTotalSize()}px`,
                                                width: '100%',
                                                position: 'relative',
                                            }}
                                        >
                                            {isMounted && virtualizer.getVirtualItems().map((virtualItem) => {
                                                const { item, isSelected } = sortedSearchScopeItems[virtualItem.index];
                                                const isHighlighted = virtualItem.index === highlightedIndex;
                                                return (
                                                    <div
                                                        key={`${item.type}-${item.value}`}
                                                        onClick={() => toggleItem(item)}
                                                        onMouseEnter={() => setHighlightedIndex(virtualItem.index)}
                                                        className={cn(
                                                            "cursor-pointer absolute top-0 left-0 w-full flex items-center px-2 py-1.5 text-sm rounded-sm",
                                                            isHighlighted ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground"
                                                        )}
                                                        style={{
                                                            transform: `translateY(${virtualItem.start}px)`,
                                                        }}
                                                    >
                                                        <div
                                                            className={cn(
                                                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                                isSelected
                                                                    ? "bg-primary text-primary-foreground"
                                                                    : "opacity-50 [&_svg]:invisible"
                                                            )}
                                                        >
                                                            <CheckIcon className="h-4 w-4" />
                                                        </div>
                                                        <div className="flex flex-row items-center gap-2 w-full overflow-hidden">
                                                            <SearchScopeIcon searchScope={item} />
                                                            <p className="font-medium truncate-start">{item.name}</p>
                                                            {item.type === 'reposet' && (
                                                                <Badge
                                                                    variant="default"
                                                                    className="text-[10px] px-1.5 py-0 h-4 bg-primary text-primary-foreground"
                                                                >
                                                                    {item.repoCount} repo{item.repoCount === 1 ? '' : 's'}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {selectedSearchScopes.length > 0 && (
                                <>
                                    <Separator />
                                    <div
                                        onClick={handleClear}
                                        className="flex items-center justify-center px-2 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                                    >
                                        Clear
                                    </div>
                                </>
                            )}
                        </div>
                    </PopoverContent>
                </Tooltip>
            </Popover>
        );
    }
);

SearchScopeSelector.displayName = "SearchScopeSelector";