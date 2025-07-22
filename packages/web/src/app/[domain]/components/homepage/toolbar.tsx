'use client';

import { KeyboardShortcutHint } from "@/app/components/keyboardShortcutHint";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export type SearchMode = "precise" | "agentic";

export interface ToolbarProps {
    searchMode: SearchMode;
    isAgenticSearchEnabled: boolean;
    onSearchModeChange: (searchMode: SearchMode) => void;
    children?: React.ReactNode;
}

export const Toolbar = ({
    searchMode,
    isAgenticSearchEnabled,
    onSearchModeChange,
    children: tools,
}: ToolbarProps) => {
    const [focusedSearchMode, setFocusedSearchMode] = useState<SearchMode>(searchMode);

    return (
        <div className="w-full flex flex-row items-center bg-accent rounded-b-md px-2">
            {tools}
            <div className="flex flex-row items-center ml-auto">
                <p className="text-sm text-muted-foreground mr-1.5">Search mode:</p>
                <Select
                    value={searchMode}
                    onValueChange={(value) => onSearchModeChange(value as "precise" | "agentic")}
                >
                    <SelectTrigger
                        className="h-6 mt-0.5 font-mono font-semibold text-xs p-0 w-fit border-none bg-inherit"
                    >
                        <SelectValue>
                            {searchMode === "precise" ? "Precise" : "Agentic"}
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
                                        <div className="flex flex-row items-center gap-2">
                                            <span>Precise</span>
                                            <Separator orientation="vertical" className="h-4" />
                                            <KeyboardShortcutHint shortcut="⌘ P" />
                                        </div>

                                    </SelectItem>
                                    <TooltipContent
                                        side="right"
                                        className="w-64 z-50"
                                        sideOffset={8}
                                    >
                                        <div className="flex flex-col gap-2">
                                            <p className="font-semibold">Precise Search</p>
                                            <Separator orientation="horizontal" className="w-full my-0.5" />
                                            <p>Search for exact matches using regular expressions and filters.</p>
                                            <Link
                                                href="https://docs.sourcebot.dev/docs/features/search/syntax-reference"
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
                                >
                                    <SelectItem
                                        value="agentic"
                                        className={cn({
                                            "cursor-not-allowed": !isAgenticSearchEnabled,
                                            "cursor-pointer": isAgenticSearchEnabled,
                                        })}
                                        disabled={!isAgenticSearchEnabled}
                                    >

                                        <div className="flex flex-row items-center gap-2">
                                            <span>Agentic</span>
                                            <Separator orientation="vertical" className="h-4" />
                                            <KeyboardShortcutHint shortcut="⌘ I" />
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
                                            <TriangleAlert className="w-4 h-4 text-destructive flex-shrink-0 text-yellow-300" />
                                        )}
                                        <p className="font-semibold">Agentic Search</p>
                                    </div>
                                    {!isAgenticSearchEnabled && (
                                        <p className="text-destructive">Language model not configured.</p>
                                    )}
                                    <Separator orientation="horizontal" className="w-full my-0.5" />
                                    <p>Use natural language to search, summarize and understand your codebase using a reasoning agent.</p>
                                    <Link
                                        href="https://docs.sourcebot.dev/docs/features/search/agentic-search"
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
        </div>
    )
}


