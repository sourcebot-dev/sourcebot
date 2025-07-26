// Adapted from: web/src/components/ui/multi-select.tsx

import * as React from "react";
import {
    CheckIcon,
    ChevronDown,
    FolderIcon,
    LayersIcon,
    LibraryBigIcon,
} from "lucide-react";
import Image from "next/image";

import { cn, getCodeHostIcon } from "@/lib/utils";
import { RepositoryQuery, SearchContextQuery } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";

export type RepoContextItem = {
    type: 'repo';
    value: string;
    name: string;
    codeHostType: string;
}

export type SearchContextItem = {
    type: 'context';
    value: string;
    name: string;
    repoCount: number;
}

export type ContextItem = RepoContextItem | SearchContextItem;

interface ContextSelectorProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    repos: RepositoryQuery[];
    searchContexts: SearchContextQuery[];
    selectedItems: ContextItem[];
    onSelectedItemsChange: (items: ContextItem[]) => void;
    className?: string;
    isOpen: boolean;
    onOpenChanged: (isOpen: boolean) => void;
}

export const ContextSelector = React.forwardRef<
    HTMLButtonElement,
    ContextSelectorProps
>(
    (
        {
            repos,
            searchContexts,
            onSelectedItemsChange,
            className,
            selectedItems,
            isOpen,
            onOpenChanged,
            ...props
        },
        ref
    ) => {
        const scrollContainerRef = React.useRef<HTMLDivElement>(null);
        const scrollPosition = React.useRef<number>(0);

        const handleInputKeyDown = (
            event: React.KeyboardEvent<HTMLInputElement>
        ) => {
            if (event.key === "Enter") {
                onOpenChanged(true);
            } else if (event.key === "Backspace" && !event.currentTarget.value) {
                const newSelectedItems = [...selectedItems];
                newSelectedItems.pop();
                onSelectedItemsChange(newSelectedItems);
            }
        };

        const toggleItem = (item: ContextItem) => {
            // Store current scroll position before state update
            if (scrollContainerRef.current) {
                scrollPosition.current = scrollContainerRef.current.scrollTop;
            }

            const isSelected = selectedItems.some(
                (selected) => selected.type === item.type && selected.value === item.value
            );
            
            const newSelectedItems = isSelected
                ? selectedItems.filter(
                    (selected) => !(selected.type === item.type && selected.value === item.value)
                  )
                : [...selectedItems, item];
            onSelectedItemsChange(newSelectedItems);
        };

        const handleClear = () => {
            onSelectedItemsChange([]);
        };

        const handleTogglePopover = () => {
            onOpenChanged(!isOpen);
        };

        const allItems = React.useMemo(() => {
            const contextItems: ContextItem[] = searchContexts.map(context => ({
                type: 'context' as const,
                value: context.name,
                name: context.name,
                repoCount: context.repoCount
            }));
            
            const repoItems: ContextItem[] = repos.map(repo => ({
                type: 'repo' as const,
                value: repo.repoName,
                name: repo.repoDisplayName || repo.repoName.split('/').pop() || repo.repoName,
                codeHostType: repo.codeHostType,
            }));
            
            return [...contextItems, ...repoItems];
        }, [repos, searchContexts]);

        const sortedItems = React.useMemo(() => {
            return allItems
                .map((item) => ({
                    item,
                    isSelected: selectedItems.some(
                        (selected) => selected.type === item.type && selected.value === item.value
                    )
                }))
                .sort((a, b) => {
                    // Selected items first
                    if (a.isSelected && !b.isSelected) return -1;
                    if (!a.isSelected && b.isSelected) return 1;
                    // Then contexts before repos
                    if (a.item.type === 'context' && b.item.type === 'repo') return -1;
                    if (a.item.type === 'repo' && b.item.type === 'context') return 1;
                    return 0;
                })
        }, [allItems, selectedItems]);

        // Restore scroll position after re-render
        React.useEffect(() => {
            if (scrollContainerRef.current && scrollPosition.current > 0) {
                scrollContainerRef.current.scrollTop = scrollPosition.current;
            }
        }, [sortedItems]);

        return (
            <Popover
                open={isOpen}
                onOpenChange={onOpenChanged}
            >
                <PopoverTrigger asChild>
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
                            <LayersIcon className="h-4 w-4 text-muted-foreground mr-1" />
                            <span
                                className={cn("text-sm text-muted-foreground mx-1 font-medium")}
                            >
                                {
                                    selectedItems.length === 0 ? `Select context` :
                                        selectedItems.length === 1 ? selectedItems[0].name :
                                            `${selectedItems.length} selected`
                                }
                            </span>
                            <ChevronDown className="h-4 cursor-pointer text-muted-foreground ml-2" />
                        </div>
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    className="w-auto p-0"
                    align="start"
                    onEscapeKeyDown={() => onOpenChanged(false)}
                >
                    <Command>
                        <CommandInput
                            placeholder="Search contexts and repos..."
                            onKeyDown={handleInputKeyDown}
                        />
                        <CommandList ref={scrollContainerRef}>
                            <CommandEmpty>No results found.</CommandEmpty>
                            <CommandGroup>
                                {sortedItems.map(({ item, isSelected }) => {
                                    return (
                                        <CommandItem
                                            key={`${item.type}-${item.value}`}
                                            onSelect={() => toggleItem(item)}
                                            className="cursor-pointer"
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
                                            <div className="flex items-center gap-2 flex-1">
                                                {item.type === 'context' ? (
                                                    <LibraryBigIcon className="h-4 w-4 text-muted-foreground" />
                                                ) : (
                                                    // Render code host icon for repos
                                                    (() => {
                                                        const codeHostIcon = item.codeHostType ? getCodeHostIcon(item.codeHostType) : null;
                                                        return codeHostIcon ? (
                                                            <Image 
                                                                src={codeHostIcon.src} 
                                                                alt={`${item.codeHostType} icon`}
                                                                width={16}
                                                                height={16}
                                                                className={cn("h-4 w-4", codeHostIcon.className)}
                                                            />
                                                        ) : (
                                                            <FolderIcon className="h-4 w-4 text-muted-foreground" />
                                                        );
                                                    })()
                                                )}
                                                <div className="flex flex-col flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">
                                                            {item.name}
                                                        </span>
                                                        {item.type === 'context' && item.repoCount && (
                                                            <Badge 
                                                                variant="default" 
                                                                className="text-[10px] px-1.5 py-0 h-4 bg-primary text-primary-foreground"
                                                            >
                                                                {item.repoCount} repo{item.repoCount === 1 ? '' : 's'}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </CommandList>
                        {selectedItems.length > 0 && (
                            <>
                                <CommandSeparator />
                                <CommandItem
                                    onSelect={handleClear}
                                    className="flex-1 justify-center cursor-pointer"
                                >
                                    Clear
                                </CommandItem>
                            </>
                        )}
                    </Command>
                </PopoverContent>
            </Popover>
        );
    }
);

ContextSelector.displayName = "ContextSelector";