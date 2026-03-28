'use client';

import { Separator } from "@/components/ui/separator";
import { LanguageModelInfo, SearchScope } from "@/features/chat/types";
import { RepositoryQuery, SearchContextQuery } from "@/lib/types";
import { useSelectedLanguageModel } from "../../useSelectedLanguageModel";
import { AtMentionButton } from "./atMentionButton";
import { ChatBoxPlusButton } from "./chatBoxPlusButton";
import { LanguageModelSelector } from "./languageModelSelector";
import { SearchScopeSelector } from "./searchScopeSelector";

export interface ChatBoxToolbarProps {
    languageModels: LanguageModelInfo[];
    repos: RepositoryQuery[];
    searchContexts: SearchContextQuery[];
    selectedSearchScopes: SearchScope[];
    onSelectedSearchScopesChange: (items: SearchScope[]) => void;
    isContextSelectorOpen: boolean;
    onContextSelectorOpenChanged: (isOpen: boolean) => void;
    // TODO_Jack_MakeLinearTask: Make the plus button available on simplified toolbar usages (e.g. askgh)
    // once additional features (beyond MCP server toggling) are added to it.
    disabledMcpServerIds?: string[];
    onDisabledMcpServerIdsChange?: (ids: string[]) => void;
}

export const ChatBoxToolbar = ({
    languageModels,
    repos,
    searchContexts,
    selectedSearchScopes,
    onSelectedSearchScopesChange,
    isContextSelectorOpen,
    onContextSelectorOpenChanged,
    disabledMcpServerIds,
    onDisabledMcpServerIdsChange,
}: ChatBoxToolbarProps) => {
    const { selectedLanguageModel, setSelectedLanguageModel } = useSelectedLanguageModel({
        languageModels,
    });

    return (
        <>
            {disabledMcpServerIds !== undefined && onDisabledMcpServerIdsChange !== undefined && (
                <>
                    <ChatBoxPlusButton
                        disabledMcpServerIds={disabledMcpServerIds}
                        onDisabledMcpServerIdsChange={onDisabledMcpServerIdsChange}
                    />
                    <Separator orientation="vertical" className="h-3 mx-1" />
                </>
            )}
            <AtMentionButton />
            <Separator orientation="vertical" className="h-3 mx-1" />
            <SearchScopeSelector
                className="bg-inherit w-fit h-6 min-h-6"
                repos={repos}
                searchContexts={searchContexts}
                selectedSearchScopes={selectedSearchScopes}
                onSelectedSearchScopesChange={onSelectedSearchScopesChange}
                isOpen={isContextSelectorOpen}
                onOpenChanged={onContextSelectorOpenChanged}
            />
            <Separator orientation="vertical" className="h-3 ml-1 mr-2" />
            <LanguageModelSelector
                languageModels={languageModels}
                onSelectedModelChange={setSelectedLanguageModel}
                selectedModel={selectedLanguageModel}
            />
        </>
    )
}
