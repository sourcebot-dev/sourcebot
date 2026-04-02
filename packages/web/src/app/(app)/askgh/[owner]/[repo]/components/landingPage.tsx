'use client';

import Image from 'next/image';
import { SearchModeSelector } from "@/app/(app)/components/searchModeSelector";
import { Separator } from "@/components/ui/separator";
import { ChatBox } from "@/features/chat/components/chatBox";
import { ChatBoxToolbar } from "@/features/chat/components/chatBox/chatBoxToolbar";
import { LoginModal } from "@/app/components/loginModal";
import { NotConfiguredErrorBanner } from "@/features/chat/components/notConfiguredErrorBanner";
import { LanguageModelInfo, RepoSearchScope } from "@/features/chat/types";
import { useCreateNewChatThread } from "@/features/chat/useCreateNewChatThread";
import { getRepoImageSrc } from '@/lib/utils';
import { useMemo, useState } from "react";

interface LandingPageProps {
    languageModels: LanguageModelInfo[];
    repoName: string;
    repoDisplayName?: string;
    imageUrl?: string | null;
    repoId: number;
    isAuthenticated: boolean;
}

export const LandingPage = ({
    languageModels,
    repoName,
    repoDisplayName,
    imageUrl,
    repoId,
    isAuthenticated,
}: LandingPageProps) => {
    const { createNewChatThread, isLoading, loginWall } = useCreateNewChatThread({ isAuthenticated });
    const [isContextSelectorOpen, setIsContextSelectorOpen] = useState(false);
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
                <div className="w-full">
                    <div className="border rounded-md w-full shadow-sm">
                        <ChatBox
                            onSubmit={(children) => {
                                createNewChatThread(children, selectedSearchScopes);
                            }}
                            className="min-h-[50px]"
                            isRedirecting={isLoading}
                            languageModels={languageModels}
                            selectedSearchScopes={selectedSearchScopes}
                            searchContexts={[]}
                            isDisabled={isChatBoxDisabled}
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
            </div>

            <LoginModal
                isOpen={loginWall.isOpen}
                onOpenChange={loginWall.onOpenChange}
                providers={loginWall.providers}
                callbackUrl={typeof window !== 'undefined' ? window.location.href : ''}
            />
        </div>
    )
}
