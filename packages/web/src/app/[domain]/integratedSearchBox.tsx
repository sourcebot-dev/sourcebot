'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CustomSlateEditor } from "@/features/chat/customSlateEditor";
import { useState } from "react";
import { ChatBox } from "../../features/chat/components/chatBox";
import { ChatBoxTools } from "../../features/chat/components/chatBoxTools";
import { SearchBar } from "./components/searchBar";
import { CreateMessage } from "ai";
import { getAllMentionElements, toString } from "@/features/chat/utils";
import { cn, createPathWithQueryParams } from "@/lib/utils";
import { useDomain } from "@/hooks/useDomain";
import { useRouter } from "next/navigation";
import { ModelProviderInfo, SET_CHAT_STATE_QUERY_PARAM, SetChatStatePayload } from "@/features/chat/types";
import { useLocalStorage } from "usehooks-ts";
import { KeyboardShortcutHint } from "@/app/components/keyboardShortcutHint";
import { useHotkeys } from "react-hotkeys-hook";

type SearchMode = "precise" | "agentic";

interface IntegratedSearchBoxProps {
    modelProviderInfo?: ModelProviderInfo;
}

export const IntegratedSearchBox = ({
    modelProviderInfo,
}: IntegratedSearchBoxProps) => {
    const [searchMode, setSearchMode] = useLocalStorage<SearchMode>("search-mode", "precise", { initializeWithValue: false });
    const [selectedRepos, setSelectedRepos] = useState<string[]>([]);
    const domain = useDomain();
    const router = useRouter();

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
                        isAgenticSearchEnabled={!!modelProviderInfo?.provider}
                        onSearchModeChange={setSearchMode}
                    />
                </>
            ) : (
                <CustomSlateEditor>
                    <ChatBox
                        onSubmit={(children) => {
                            const text = toString(children);
                            const mentions = getAllMentionElements(children);

                            const inputMessage: CreateMessage = {
                                role: "user",
                                content: text,
                                annotations: mentions.map((mention) => mention.data),
                            };

                            const url = createPathWithQueryParams(`/${domain}/chat`,
                                [SET_CHAT_STATE_QUERY_PARAM, JSON.stringify({
                                    inputMessage,
                                    selectedRepos,
                                } satisfies SetChatStatePayload)],
                            );
                            router.push(url);
                        }}
                        className="min-h-[50px]"
                        selectedRepos={selectedRepos}
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
