'use client';

import { KeyboardShortcutHint } from "@/app/components/keyboardShortcutHint";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { MessageCircleIcon, SearchIcon, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export type SearchMode = "precise" | "agentic";

const PRECISE_SEARCH_DOCS_URL = "https://docs.sourcebot.dev/docs/features/search/overview";
// @tood: point this to the actual docs page
const AGENTIC_SEARCH_DOCS_URL = "https://docs.sourcebot.dev/docs/features/ask/overview";

export interface SearchModeSelectorProps {
    searchMode: SearchMode;
    isAgenticSearchEnabled: boolean;
    onSearchModeChange: (searchMode: SearchMode) => void;
    className?: string;
}

export const SearchModeSelector = ({
    searchMode,
    isAgenticSearchEnabled,
    onSearchModeChange,
    className,
}: SearchModeSelectorProps) => {
    const [focusedSearchMode, setFocusedSearchMode] = useState<SearchMode>(searchMode);

    return (
        <div className={cn("flex flex-row items-center", className)}>
            <Select
                value={searchMode}
                onValueChange={(value) => onSearchModeChange(value as "precise" | "agentic")}
            >
                <SelectTrigger
                    className="flex flex-row items-center h-6 mt-0.5 font-mono font-semibold text-xs p-0 w-fit border-none bg-inherit rounded-md"
                >
                    {searchMode === "precise" ? (
                        <SearchIcon className="w-4 h-4 text-muted-foreground mr-1.5" />
                    ) : (
                        <MessageCircleIcon className="w-4 h-4 text-muted-foreground mr-1.5" />
                    )}
                    <SelectValue>
                        {searchMode === "precise" ? "Code Search" : "Ask"}
                    </SelectValue>
                </SelectTrigger>

                <SelectContent
                    className="overflow-visible relative"
                >
                    <Tooltip
                        delayDuration={100}
                        open={focusedSearchMode === "precise"}
                    >
                        <TooltipTrigger asChild>
                            <div
                                onMouseEnter={() => setFocusedSearchMode("precise")}
                                onFocus={() => setFocusedSearchMode("precise")}
                            >
                                <SelectItem
                                    value="precise"
                                    className="cursor-pointer"
                                >
                                    <div className="flex flex-row items-center justify-between w-full gap-1.5">
                                        <span>Search</span>
                                        <div className="flex flex-row items-center gap-2">
                                            <Separator orientation="vertical" className="h-4" />
                                            <KeyboardShortcutHint shortcut="⌘ P" />
                                        </div>
                                    </div>

                                </SelectItem>
                                <TooltipContent
                                    side="right"
                                    className="w-64 z-50"
                                    sideOffset={8}
                                >
                                    <div className="flex flex-col gap-2">
                                        <p className="font-semibold">Code Search</p>
                                        <Separator orientation="horizontal" className="w-full my-0.5" />
                                        <p>Search for exact matches using regular expressions and filters.</p>
                                        <Link
                                            href={PRECISE_SEARCH_DOCS_URL}
                                            className="text-link hover:underline"
                                        >
                                            Docs
                                        </Link>
                                    </div>
                                </TooltipContent>
                            </div>
                        </TooltipTrigger>
                    </Tooltip>
                    <Tooltip delayDuration={100} open={focusedSearchMode === "agentic"}>
                        <TooltipTrigger asChild>
                            <div
                                onMouseEnter={() => setFocusedSearchMode("agentic")}
                                onFocus={() => setFocusedSearchMode("agentic")}
                                className={cn({
                                    "cursor-not-allowed": !isAgenticSearchEnabled,
                                })}
                            >
                                <SelectItem
                                    value="agentic"
                                    disabled={!isAgenticSearchEnabled}
                                    className={cn({
                                        "cursor-pointer": isAgenticSearchEnabled,
                                    })}
                                >
                                    <div className="flex flex-row items-center justify-between w-full gap-1.5">
                                        <span>Ask</span>

                                        <div className="flex flex-row items-center gap-2">
                                            <Separator orientation="vertical" className="h-4" />
                                            <KeyboardShortcutHint shortcut="⌘ I" />
                                        </div>
                                    </div>
                                </SelectItem>

                            </div>
                        </TooltipTrigger>
                        <TooltipContent
                            side="right"
                            className="w-64 z-50"
                            sideOffset={8}
                        >
                            <div className="flex flex-col gap-2">
                                <div className="flex flex-row items-center gap-2">
                                    {!isAgenticSearchEnabled && (
                                        <TriangleAlert className="w-4 h-4 flex-shrink-0 text-warning" />
                                    )}
                                    <p className="font-semibold">Ask Sourcebot</p>
                                </div>
                                {!isAgenticSearchEnabled && (
                                    <p className="text-destructive">Language model not configured. <Link href={AGENTIC_SEARCH_DOCS_URL} className="text-link hover:underline">See setup instructions.</Link></p>
                                )}
                                <Separator orientation="horizontal" className="w-full my-0.5" />
                                <p>Use natural language to search, summarize and understand your codebase using a reasoning agent.</p>
                                <Link
                                    href={AGENTIC_SEARCH_DOCS_URL}
                                    className="text-link hover:underline"
                                >
                                    Docs
                                </Link>
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </SelectContent>
            </Select>
        </div>
    )
}


