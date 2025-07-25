// Adapted from: web/src/components/ui/multi-select.tsx

import * as React from "react";
import {
    CheckIcon,
    ChevronDown,
    BookMarkedIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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

interface RepoSelectorProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    repos: string[];
    selectedRepos: string[];
    onSelectedReposChange: (repos: string[]) => void;
    className?: string;
    isOpen: boolean;
    onOpenChanged: (isOpen: boolean) => void;
}

export const RepoSelector = React.forwardRef<
    HTMLButtonElement,
    RepoSelectorProps
>(
    (
        {
            repos,
            onSelectedReposChange,
            className,
            selectedRepos,
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
                const newSelectedRepos = [...selectedRepos];
                newSelectedRepos.pop();
                onSelectedReposChange(newSelectedRepos);
            }
        };

        const toggleRepo = (repo: string) => {
            // Store current scroll position before state update
            if (scrollContainerRef.current) {
                scrollPosition.current = scrollContainerRef.current.scrollTop;
            }

            const newSelectedValues = selectedRepos.includes(repo)
                ? selectedRepos.filter((value) => value !== repo)
                : [...selectedRepos, repo];
            onSelectedReposChange(newSelectedValues);
        };

        const handleClear = () => {
            onSelectedReposChange([]);
        };

        const handleTogglePopover = () => {
            onOpenChanged(!isOpen);
        };

        const sortedRepos = React.useMemo(() => {
            return repos
                .map((repo) => ({
                    repo,
                    isSelected: selectedRepos.includes(repo)
                }))
                .sort((a, b) => {
                    if (a.isSelected && !b.isSelected) return -1;
                    if (!a.isSelected && b.isSelected) return 1;
                    return 0;
                })
        }, [repos, selectedRepos]);

        // Restore scroll position after re-render
        React.useEffect(() => {
            if (scrollContainerRef.current && scrollPosition.current > 0) {
                scrollContainerRef.current.scrollTop = scrollPosition.current;
            }
        }, [sortedRepos]);

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
                            <BookMarkedIcon className="h-4 w-4 text-muted-foreground mr-1" />
                            <span
                                className={cn("text-sm text-muted-foreground mx-1 font-medium")}
                            >
                                {
                                    selectedRepos.length === 0 ? `Select a repo` :
                                        selectedRepos.length === 1 ? `${selectedRepos[0].split('/').pop()}` :
                                            `${selectedRepos.length} repo${selectedRepos.length === 1 ? '' : 's'}`
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
                            placeholder="Search repos..."
                            onKeyDown={handleInputKeyDown}
                        />
                        <CommandList ref={scrollContainerRef}>
                            <CommandEmpty>No results found.</CommandEmpty>
                            <CommandGroup>
                                {sortedRepos.map(({ repo, isSelected }) => {
                                    return (
                                        <CommandItem
                                            key={repo}
                                            onSelect={() => toggleRepo(repo)}
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
                                            <span>{repo}</span>
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </CommandList>
                        {selectedRepos.length > 0 && (
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

RepoSelector.displayName = "RepoSelector";