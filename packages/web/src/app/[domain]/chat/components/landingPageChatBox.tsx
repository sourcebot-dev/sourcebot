'use client';

import { Separator } from "@/components/ui/separator";
import { ChatBox } from "@/features/chat/components/chatBox";
import { ChatBoxToolbar } from "@/features/chat/components/chatBox/chatBoxToolbar";
import { LanguageModelInfo, SearchScope } from "@/features/chat/types";
import { useCreateNewChatThread } from "@/features/chat/useCreateNewChatThread";
import { RepositoryQuery, SearchContextQuery } from "@/lib/types";
import { useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import { SearchModeSelector } from "../../components/searchModeSelector";
import { NotConfiguredErrorBanner } from "@/features/chat/components/notConfiguredErrorBanner";
import { LoginModal } from "@/app/components/loginModal";

interface LandingPageChatBox {
    languageModels: LanguageModelInfo[];
    repos: RepositoryQuery[];
    searchContexts: SearchContextQuery[];
    isAuthenticated: boolean;
}

export const LandingPageChatBox = ({
    languageModels,
    repos,
    searchContexts,
    isAuthenticated,
}: LandingPageChatBox) => {
    const { createNewChatThread, isLoading, loginWall } = useCreateNewChatThread({ isAuthenticated });
    const [selectedSearchScopes, setSelectedSearchScopes] = useLocalStorage<SearchScope[]>("selectedSearchScopes", [], { initializeWithValue: false });
    const [disabledMcpServerIds, setDisabledMcpServerIds] = useLocalStorage<string[]>("disabledMcpServerIds", [], { initializeWithValue: false });
    const [isContextSelectorOpen, setIsContextSelectorOpen] = useState(false);
    const isChatBoxDisabled = languageModels.length === 0;

    return (
        <div className="w-full max-w-[800px] mt-4">
            <div className="border rounded-md w-full shadow-sm">
                <ChatBox
                    onSubmit={(children) => {
                        createNewChatThread(children, selectedSearchScopes, disabledMcpServerIds);
                    }}
                    className="min-h-[50px]"
                    isRedirecting={isLoading}
                    languageModels={languageModels}
                    selectedSearchScopes={selectedSearchScopes}
                    searchContexts={searchContexts}
                    isDisabled={isChatBoxDisabled}
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

            <LoginModal
                isOpen={loginWall.isOpen}
                onOpenChange={loginWall.onOpenChange}
                providers={loginWall.providers}
                callbackUrl={typeof window !== 'undefined' ? window.location.href : ''}
            />
        </div >
    )
}
