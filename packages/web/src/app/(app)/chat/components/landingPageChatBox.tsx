'use client';

import { Separator } from "@/components/ui/separator";
import { ChatBox } from "@/features/chat/components/chatBox";
import { ChatBoxToolbar } from "@/features/chat/components/chatBox/chatBoxToolbar";
import { LanguageModelInfo, SearchScope } from "@/features/chat/types";
import { useCreateNewChatThread } from "@/features/chat/useCreateNewChatThread";
import { RepositoryQuery, SearchContextQuery } from "@/lib/types";
import { useState } from "react";
import { useRegisterLandingChatBox } from "./chatLandingDropzone";
import { useLocalStorage } from "usehooks-ts";
import { DISABLED_MCP_SERVER_IDS_LOCAL_STORAGE_KEY, SELECTED_SEARCH_SCOPES_LOCAL_STORAGE_KEY } from "@/features/chat/constants";
import { SearchModeSelector } from "../../components/searchModeSelector";
import { NotConfiguredErrorBanner } from "@/features/chat/components/notConfiguredErrorBanner";

interface LandingPageChatBox {
    languageModels: LanguageModelInfo[];
    repos: RepositoryQuery[];
    searchContexts: SearchContextQuery[];
    isAuthenticated: boolean;
    isLoginWallEnabled: boolean;
    maxImageBytes: number;
    maxPdfBytes: number;
}

export const LandingPageChatBox = ({
    languageModels,
    repos,
    searchContexts,
    isAuthenticated,
    isLoginWallEnabled,
    maxImageBytes,
    maxPdfBytes,
}: LandingPageChatBox) => {
    const { createNewChatThread, isLoading } = useCreateNewChatThread();
    const [selectedSearchScopes, setSelectedSearchScopes] = useLocalStorage<SearchScope[]>(SELECTED_SEARCH_SCOPES_LOCAL_STORAGE_KEY, [], { initializeWithValue: false });
    const [disabledMcpServerIds, setDisabledMcpServerIds] = useLocalStorage<string[]>(DISABLED_MCP_SERVER_IDS_LOCAL_STORAGE_KEY, [], { initializeWithValue: false });
    const [isContextSelectorOpen, setIsContextSelectorOpen] = useState(false);
    const registerChatBox = useRegisterLandingChatBox();
    const isChatBoxDisabled = languageModels.length === 0;

    return (
        <div className="w-full max-w-[800px] mt-4">
            <div className="border rounded-md w-full shadow-sm">
                <ChatBox
                    ref={registerChatBox}
                    onSubmit={(children, _editor, attachments) => {
                        createNewChatThread(children, selectedSearchScopes, disabledMcpServerIds, attachments);
                    }}
                    className="min-h-[50px]"
                    isRedirecting={isLoading}
                    selectedSearchScopes={selectedSearchScopes}
                    searchContexts={searchContexts}
                    isDisabled={isChatBoxDisabled}
                    isAuthenticated={isAuthenticated}
                    isLoginWallEnabled={isLoginWallEnabled}
                    maxImageBytes={maxImageBytes}
                    maxPdfBytes={maxPdfBytes}
                />
                <Separator />
                <div className="relative">
                    <div className="w-full flex flex-row items-center bg-accent rounded-b-md px-2">
                        <ChatBoxToolbar
                            languageModels={languageModels}
                            repos={repos}
                            searchContexts={searchContexts}
                            selectedSearchScopes={selectedSearchScopes}
                            onSelectedSearchScopesChange={setSelectedSearchScopes}
                            isContextSelectorOpen={isContextSelectorOpen}
                            onContextSelectorOpenChanged={setIsContextSelectorOpen}
                            disabledMcpServerIds={disabledMcpServerIds}
                            onDisabledMcpServerIdsChange={setDisabledMcpServerIds}
                            isAuthenticated={isAuthenticated}
                        />
                        <SearchModeSelector
                            searchMode="agentic"
                            className="ml-auto"
                        />
                    </div>
                </div>
            </div>

            {isChatBoxDisabled && (
                <NotConfiguredErrorBanner className="mt-4" />
            )}
        </div>
    )
}
