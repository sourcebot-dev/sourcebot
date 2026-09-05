'use client';

import Image from 'next/image';
import { SearchModeSelector } from "@/app/(app)/components/searchModeSelector";
import { Separator } from "@/components/ui/separator";
import { ChatBox, ChatBoxHandle } from "@/features/chat/components/chatBox";
import { ChatBoxToolbar } from "@/features/chat/components/chatBox/chatBoxToolbar";
import { ChatPaneDropzone } from "@/features/chat/components/chatBox/chatPaneDropzone";
import { NotConfiguredErrorBanner } from "@/features/chat/components/notConfiguredErrorBanner";
import { LanguageModelInfo, RepoSearchScope, SearchScope } from "@/features/chat/types";
import { useCreateNewChatThread } from "@/features/chat/useCreateNewChatThread";
import { DISABLED_MCP_SERVER_IDS_LOCAL_STORAGE_KEY } from "@/features/chat/constants";
import { getRepoImageSrc } from '@/lib/utils';
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import type { AskCommandDefinition } from '@/features/chat/commands/types';
import { RepositoryQuery, SearchContextQuery } from "@/lib/types";

const ASKGH_SELECTED_SEARCH_SCOPES_LOCAL_STORAGE_KEY = 'askGhSelectedSearchScopes';

interface LandingPageProps {
    languageModels: LanguageModelInfo[];
    repoName: string;
    repoDisplayName?: string;
    imageUrl?: string | null;
    repoId: number;
    askCommands: AskCommandDefinition[];
    isAuthenticated: boolean;
    maxImageBytes: number;
    repos: RepositoryQuery[];
    searchContexts: SearchContextQuery[];
}

export const LandingPage = ({
    languageModels,
    repoName,
    repoDisplayName,
    imageUrl,
    repoId,
    askCommands,
    isAuthenticated,
    maxImageBytes,
    repos,
    searchContexts,
}: LandingPageProps) => {
    const { createNewChatThread, isLoading } = useCreateNewChatThread();
    const [isContextSelectorOpen, setIsContextSelectorOpen] = useState(false);
    const [disabledMcpServerIds, setDisabledMcpServerIds] = useLocalStorage<string[]>(DISABLED_MCP_SERVER_IDS_LOCAL_STORAGE_KEY, [], { initializeWithValue: false });
    const chatBoxRef = useRef<ChatBoxHandle>(null);
    const isChatBoxDisabled = languageModels.length === 0;

    // Default scope for the current repo
    const defaultRepoScope = useMemo(() => ({
        type: 'repo' as const,
        name: repoDisplayName ?? repoName,
        value: repoName,
        codeHostType: 'github' as const,
    } satisfies RepoSearchScope), [repoDisplayName, repoName]);

    // Use local storage for selected scopes, with the current repo as default
    const [selectedSearchScopes, setSelectedSearchScopes] = useLocalStorage<SearchScope[]>(
        ASKGH_SELECTED_SEARCH_SCOPES_LOCAL_STORAGE_KEY,
        [defaultRepoScope],
        { initializeWithValue: false }
    );

    // Ensure the current repo is always included in selected scopes when visiting this page
    // This handles the case where the user visits a different repo's Ask GH page
    const [hasInitialized, setHasInitialized] = useState(false);
    useEffect(() => {
        if (hasInitialized) {
            return;
        }
        setHasInitialized(true);
        
        // Check if the current repo is already in the selected scopes
        const currentRepoIncluded = selectedSearchScopes.some(
            (scope) => scope.type === 'repo' && scope.value === repoName
        );
        
        // If not, add it to the scopes
        if (!currentRepoIncluded) {
            setSelectedSearchScopes([defaultRepoScope, ...selectedSearchScopes]);
        }
    }, [hasInitialized, selectedSearchScopes, repoName, defaultRepoScope, setSelectedSearchScopes]);

    const imageSrc = imageUrl ? getRepoImageSrc(imageUrl, repoId) : undefined;
    const displayName = repoDisplayName ?? repoName;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
            {/* Centered Content - Repository Info + ChatBox */}
            <div className="flex flex-col items-center gap-8 w-full max-w-[800px]">
                {/* Repository Info */}
                <div className="flex items-center gap-4">
                    {imageSrc && (
                        <Image
                            src={imageSrc}
                            alt={`${displayName} avatar`}
                            width={32}
                            height={32}
                            className="rounded-lg"
                            unoptimized={imageSrc.startsWith('/api/')}
                        />
                    )}
                    <h1 className="text-2xl font-bold">{displayName}</h1>
                </div>

                {/* ChatBox */}
                <ChatPaneDropzone
                    className="w-full"
                    onFilesDropped={(files) => chatBoxRef.current?.addFiles(files)}
                    disabled={isChatBoxDisabled}
                >
                    <div className="border rounded-md w-full shadow-sm">
                        <ChatBox
                            ref={chatBoxRef}
                            onSubmit={(children, _editor, attachments) => {
                                createNewChatThread(children, selectedSearchScopes, disabledMcpServerIds, attachments);
                            }}
                            className="min-h-[50px]"
                            isRedirecting={isLoading}
                            selectedSearchScopes={selectedSearchScopes}
                            searchContexts={searchContexts}
                            askCommands={askCommands}
                            isDisabled={isChatBoxDisabled}
                            isAuthenticated={isAuthenticated}
                            isLoginWallEnabled={true}
                            maxImageBytes={maxImageBytes}
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
                </ChatPaneDropzone>
            </div>
        </div>
    )
}
