'use client';

import { KeyboardShortcutHint } from "@/app/components/keyboardShortcutHint";
import { SourcebotLogo } from "@/app/components/sourcebotLogo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ChatBox } from "@/features/chat/components/chatBox";
import { ChatBoxTools } from "@/features/chat/components/chatBoxTools";
import { CustomSlateEditor } from "@/features/chat/customSlateEditor";
import { ModelProviderInfo } from "@/features/chat/types";
import { useCreateNewChatThread } from "@/features/chat/useCreateNewChatThread";
import { RepositoryQuery } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useLocalStorage } from "usehooks-ts";
import { SearchBar } from "../searchBar";
import { AgenticSearchInfo } from "./agenticSearchInfo";
import { PreciseSearchInfo } from "./preciseSearchInfo";

interface HomepageProps {
    initialRepos: RepositoryQuery[];
    modelProviderInfo?: ModelProviderInfo;
}

type SearchMode = "precise" | "agentic";

export const Homepage = ({
    initialRepos,
    modelProviderInfo,
}: HomepageProps) => {
    const [searchMode, setSearchMode] = useLocalStorage<SearchMode>("search-mode", "precise", { initializeWithValue: false });
    const { createNewChatThread, isLoading } = useCreateNewChatThread();
    const [selectedRepos, setSelectedRepos] = useState<string[]>([]);

    useHotkeys("mod+i", (e) => {
        e.preventDefault();
        setSearchMode("agentic");
    }, {
        enableOnFormTags: true,
        enableOnContentEditable: true,
        description: "Switch to agentic search",
    });

    useHotkeys("mod+p", (e) => {
        e.preventDefault();
        setSearchMode("precise");
    }, {
        enableOnFormTags: true,
        enableOnContentEditable: true,
        description: "Switch to precise search",
    });

    return (
        <div className="flex flex-col justify-center items-center mt-8 mb-8 md:mt-18 w-full px-5">
            <div className="max-h-44 w-auto">
                <SourcebotLogo
                    className="h-18 md:h-40 w-auto"
                />
            </div>

            <div className="mt-4 w-full max-w-[800px] border rounded-md shadow-sm">
                {searchMode === "precise" ? (
                    <>
                        <SearchBar
                            autoFocus={true}
                            className="border-none pt-0.5 pb-0"
                        />
                        <Separator />
                        <Toolbar
                            searchMode={searchMode}
                            isAgenticSearchEnabled={!!modelProviderInfo?.provider}
                            onSearchModeChange={setSearchMode}
                        />
                    </>
                ) : (
                    <CustomSlateEditor>
                        <ChatBox
                            onSubmit={(children) => {
                                createNewChatThread(children, selectedRepos);
                            }}
                            className="min-h-[50px]"
                            selectedRepos={selectedRepos}
                            isRedirecting={isLoading}
                        />
                        <Separator />
                        <Toolbar
                            searchMode={searchMode}
                            onSearchModeChange={setSearchMode}
                            isAgenticSearchEnabled={!!modelProviderInfo}
                        >
                            <ChatBoxTools
                                selectedRepos={selectedRepos}
                                onSelectedReposChange={setSelectedRepos}
                                modelProviderInfo={modelProviderInfo}
                            />
                        </Toolbar>
                    </CustomSlateEditor>
                )}
            </div>

            {searchMode === "precise" ? (
                <PreciseSearchInfo
                    initialRepos={initialRepos}
                />
            ) : (
                <AgenticSearchInfo />
            )}
        </div>
    )
}


interface ToolbarProps {
    searchMode: SearchMode;
    isAgenticSearchEnabled: boolean;
    onSearchModeChange: (searchMode: SearchMode) => void;
    children?: React.ReactNode;
}

const Toolbar = ({
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
                    onValueChange={(value) => onSearchModeChange(value as SearchMode)}
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


