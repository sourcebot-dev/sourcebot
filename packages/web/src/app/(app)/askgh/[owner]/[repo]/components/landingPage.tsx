'use client';

import Image from 'next/image';
import { SearchModeSelector } from "@/app/(app)/components/searchModeSelector";
import { Separator } from "@/components/ui/separator";
import { ChatBox, ChatBoxHandle } from "@/features/chat/components/chatBox";
import { ChatBoxToolbar } from "@/features/chat/components/chatBox/chatBoxToolbar";
import { ChatPaneDropzone } from "@/features/chat/components/chatBox/chatPaneDropzone";
import { NotConfiguredErrorBanner } from "@/features/chat/components/notConfiguredErrorBanner";
import { LanguageModelInfo, RepoSearchScope } from "@/features/chat/types";
import { useCreateNewChatThread } from "@/features/chat/useCreateNewChatThread";
import { DISABLED_MCP_SERVER_IDS_LOCAL_STORAGE_KEY } from "@/features/chat/constants";
import { getRepoImageSrc } from '@/lib/utils';
import { useMemo, useRef, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import type { AskCommandDefinition } from '@/features/chat/commands/types';

interface LandingPageProps {
    languageModels: LanguageModelInfo[];
    repoName: string;
    repoDisplayName?: string;
    imageUrl?: string | null;
    repoId: number;
    askCommands: AskCommandDefinition[];
    isAuthenticated: boolean;
    maxImageBytes: number;
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
}: LandingPageProps) => {
    const { createNewChatThread, isLoading } = useCreateNewChatThread();
    const [isContextSelectorOpen, setIsContextSelectorOpen] = useState(false);
    const [disabledMcpServerIds, setDisabledMcpServerIds] = useLocalStorage<string[]>(DISABLED_MCP_SERVER_IDS_LOCAL_STORAGE_KEY, [], { initializeWithValue: false });
    const chatBoxRef = useRef<ChatBoxHandle>(null);
    const isChatBoxDisabled = languageModels.length === 0;

    const selectedSearchScopes = useMemo(() => [
        {
            type: 'repo',
            name: repoDisplayName ?? repoName,
            value: repoName,
            codeHostType: 'github' as const,
        } satisfies RepoSearchScope,
    ], [repoDisplayName, repoName]);

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
                            searchContexts={[]}
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
                                    repos={[]}
                                    searchContexts={[]}
                                    selectedSearchScopes={selectedSearchScopes}
                                    onSelectedSearchScopesChange={() => { }}
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
