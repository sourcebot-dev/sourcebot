'use client';

import { KeyboardShortcutHint } from "@/app/components/keyboardShortcutHint";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

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
                    <SelectContent>
                        <SelectItem
                            value="precise"
                            className={cn(
                                searchMode !== "precise" && "cursor-pointer",
                            )}
                        >
                            <div className="flex flex-row items-center gap-2">
                                <span>Precise</span>
                                <Separator orientation="vertical" className="h-4" />
                                <KeyboardShortcutHint shortcut="⌘ P" />
                            </div>
                        </SelectItem>
                        <SelectItem
                            value="agentic"
                            className={cn(
                                !isAgenticSearchEnabled && "cursor-not-allowed",
                                (isAgenticSearchEnabled && searchMode !== "agentic") && "cursor-pointer",
                            )}
                            disabled={!isAgenticSearchEnabled}
                        >
                            <div className="flex flex-row items-center gap-2">
                                <span>Agentic</span>
                                <Separator orientation="vertical" className="h-4" />
                                <KeyboardShortcutHint shortcut="⌘ I" />
                            </div>
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    )
}


