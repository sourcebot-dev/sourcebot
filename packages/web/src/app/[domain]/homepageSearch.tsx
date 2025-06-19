'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CustomSlateEditor } from "@/features/chat/customSlateEditor";
import { useState } from "react";
import { ChatBox } from "./chat/components/chatBox";
import { ChatBoxTools } from "./chat/components/chatBoxTools";
import { SearchBar } from "./components/searchBar";

type SearchMode = "precise" | "agentic";

export const HomepageSearch = () => {
    const [searchMode, setSearchMode] = useState<SearchMode>("agentic");

    return (
        <div className="mt-4 w-full max-w-[800px] border rounded-md">
            {searchMode === "precise" ? (
                <>
                    <SearchBar
                        autoFocus={true}
                        className="border-none pt-0.5 pb-0"
                    />
                    <Separator />
                    <Toolbar
                        searchMode={searchMode}
                        onSearchModeChange={setSearchMode}
                    />
                </>
            ) : (
                <CustomSlateEditor>
                    <ChatBox
                        onSubmit={() => { /* todo */ }}
                        className="min-h-[50px]"
                    />
                    <Separator />
                    <Toolbar
                        searchMode={searchMode}
                        onSearchModeChange={setSearchMode}
                    >
                        <ChatBoxTools />
                    </Toolbar>
                </CustomSlateEditor>
            )}
        </div>
    )
}

interface ToolbarProps {
    searchMode: SearchMode;
    onSearchModeChange: (searchMode: SearchMode) => void;
    children?: React.ReactNode;
}

const Toolbar = ({
    searchMode,
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
                    onValueChange={(value) => onSearchModeChange(value as SearchMode)}
                >
                    <SelectTrigger
                        className="h-6 mt-0.5 font-mono font-semibold text-xs p-0 w-fit border-none bg-inherit"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="precise">Precise</SelectItem>
                        <SelectItem value="agentic">Agentic</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    )
}
