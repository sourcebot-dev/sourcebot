'use client';

import * as React from "react";
import { Check, ChevronDown, GitBranch, Search, Tag } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getRefs } from "@/app/api/(client)/client";
import { isServiceError } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BranchTagSelectorProps {
    repoName: string;
    currentRef: string;
    onRefChange: (ref: string) => void;
}

export function BranchTagSelector({ repoName, currentRef, onRefChange }: BranchTagSelectorProps) {
    const [open, setOpen] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState<'branches' | 'tags'>('branches');
    const [searchQuery, setSearchQuery] = React.useState('');
    const inputRef = React.useRef<HTMLInputElement>(null);

    const { data: refsData, isLoading } = useQuery({
        queryKey: ['refs', repoName],
        queryFn: async () => {
            const result = await getRefs({ repoName });
            if (isServiceError(result)) {
                throw new Error('Failed to fetch refs');
            }
            return result;
        },
        enabled: open || currentRef === 'HEAD',
    });

    // Filter refs based on search query
    const filteredBranches = React.useMemo(() => {
        const branches = refsData?.branches || [];
        if (!searchQuery) return branches;
        return branches.filter(branch =>
            branch.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [refsData?.branches, searchQuery]);

    const filteredTags = React.useMemo(() => {
        const tags = refsData?.tags || [];
        if (!searchQuery) return tags;
        return tags.filter(tag =>
            tag.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [refsData?.tags, searchQuery]);

    const resolvedRef = currentRef === 'HEAD' ? (refsData?.defaultBranch || 'HEAD') : currentRef;
    const displayRef = resolvedRef.replace(/^refs\/(heads|tags)\//, '');

    const handleRefSelect = (ref: string) => {
        onRefChange(ref);
        setOpen(false);
        setSearchQuery('');
    };

    // Prevent dropdown items from stealing focus while user is typing
    const handleItemFocus = (e: React.FocusEvent) => {
        if (searchQuery) {
            e.preventDefault();
            inputRef.current?.focus();
        }
    };

    // Keep focus on the search input when typing
    React.useEffect(() => {
        if (open && searchQuery && inputRef.current) {
            const timeoutId = setTimeout(() => {
                inputRef.current?.focus();
            }, 0);
            return () => clearTimeout(timeoutId);
        }
    }, [open, searchQuery]);

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <button
                    className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                    aria-label="Switch branches or tags"
                >
                    <GitBranch className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate max-w-[150px]">{displayRef}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="start"
                className="w-[320px] p-0"
                onCloseAutoFocus={(e) => e.preventDefault()}
            >
                <div className="flex flex-col" onKeyDown={(e) => {
                    // Prevent dropdown keyboard navigation from interfering with search input
                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                        e.stopPropagation();
                    }
                }}>
                    {/* Search input */}
                    <div className="p-2 border-b">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                ref={inputRef}
                                type="text"
                                placeholder={activeTab === 'branches' ? "Find a branch..." : "Find a tag..."}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    // Prevent dropdown menu keyboard navigation
                                    e.stopPropagation();
                                }}
                                className="pl-8 h-8 text-sm"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="flex border-b">
                        <button
                            onClick={() => setActiveTab('branches')}
                            className={cn(
                                "flex-1 px-4 py-2 text-sm font-medium transition-colors border-b-2",
                                activeTab === 'branches'
                                    ? "border-blue-600 text-blue-600"
                                    : "border-transparent text-gray-600 hover:text-gray-900"
                            )}
                        >
                            <div className="flex items-center justify-center gap-1.5">
                                <GitBranch className="h-4 w-4" />
                                Branches
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('tags')}
                            className={cn(
                                "flex-1 px-4 py-2 text-sm font-medium transition-colors border-b-2",
                                activeTab === 'tags'
                                    ? "border-blue-600 text-blue-600"
                                    : "border-transparent text-gray-600 hover:text-gray-900"
                            )}
                        >
                            <div className="flex items-center justify-center gap-1.5">
                                <Tag className="h-4 w-4" />
                                Tags
                            </div>
                        </button>
                    </div>

                    <ScrollArea className="h-[300px]">
                        {isLoading ? (
                            <div className="p-4 text-sm text-gray-500 text-center">
                                Loading...
                            </div>
                        ) : (
                            <div className="p-1">
                                {activeTab === 'branches' && (
                                    <>
                                        {filteredBranches.length === 0 ? (
                                            <div className="p-4 text-sm text-gray-500 text-center">
                                                {searchQuery ? 'No branches found' : 'No branches available'}
                                            </div>
                                        ) : (
                                            filteredBranches.map((branch) => (
                                                <DropdownMenuItem
                                                    key={branch}
                                                    onClick={() => handleRefSelect(branch)}
                                                    onFocus={handleItemFocus}
                                                    className="flex items-center justify-between px-3 py-2 cursor-pointer"
                                                >
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        <GitBranch className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                                        <span className="truncate text-sm">{branch}</span>
                                                        {branch === refsData?.defaultBranch && (
                                                            <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                                                                default
                                                            </span>
                                                        )}
                                                    </div>
                                                    {branch === resolvedRef && (
                                                        <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                                    )}
                                                </DropdownMenuItem>
                                            ))
                                        )}
                                    </>
                                )}
                                {activeTab === 'tags' && (
                                    <>
                                        {filteredTags.length === 0 ? (
                                            <div className="p-4 text-sm text-gray-500 text-center">
                                                {searchQuery ? 'No tags found' : 'No tags available'}
                                            </div>
                                        ) : (
                                            filteredTags.map((tag) => (
                                                <DropdownMenuItem
                                                    key={tag}
                                                    onClick={() => handleRefSelect(tag)}
                                                    onFocus={handleItemFocus}
                                                    className="flex items-center justify-between px-3 py-2 cursor-pointer"
                                                >
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        <Tag className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                                        <span className="truncate text-sm">{tag}</span>
                                                    </div>
                                                    {tag === resolvedRef && (
                                                        <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                                    )}
                                                </DropdownMenuItem>
                                            ))
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}