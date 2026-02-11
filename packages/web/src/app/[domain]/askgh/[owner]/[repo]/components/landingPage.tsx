'use client';

import Image from 'next/image';
import { SearchModeSelector } from "@/app/[domain]/components/searchModeSelector";
import { Separator } from "@/components/ui/separator";
import { ChatBox } from "@/features/chat/components/chatBox";
import { ChatBoxToolbar } from "@/features/chat/components/chatBox/chatBoxToolbar";
import { LoginModal } from "./loginModal";
import { NotConfiguredErrorBanner } from "@/features/chat/components/notConfiguredErrorBanner";
import { LanguageModelInfo, RepoSearchScope } from "@/features/chat/types";
import { useCreateNewChatThread } from "@/features/chat/useCreateNewChatThread";
import { getRepoImageSrc } from '@/lib/utils';
import type { IdentityProviderMetadata } from "@/lib/identityProviders";
import { Descendant, Transforms } from "slate";
import { useSlate } from "slate-react";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";

const PENDING_MESSAGE_KEY = "askgh_pending_message";

interface LandingPageProps {
    languageModels: LanguageModelInfo[];
    repoName: string;
    repoDisplayName?: string;
    imageUrl?: string | null;
    repoId: number;
    providers: IdentityProviderMetadata[];
    isAuthenticated: boolean;
}

export const LandingPage = ({
    languageModels,
    repoName,
    repoDisplayName,
    imageUrl,
    repoId,
    providers,
    isAuthenticated,
}: LandingPageProps) => {
    const editor = useSlate();
    const { createNewChatThread, isLoading } = useCreateNewChatThread();
    const [isContextSelectorOpen, setIsContextSelectorOpen] = useState(false);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const hasRestoredPendingMessage = useRef(false);
    const isChatBoxDisabled = languageModels.length === 0;

    const selectedSearchScopes = useMemo(() => [
        {
            type: 'repo',
            name: repoDisplayName ?? repoName,
            value: repoName,
            codeHostType: 'github' as const,
        } satisfies RepoSearchScope,
    ], [repoDisplayName, repoName]);

    // Intercept submit to check auth status
    const handleSubmit = useCallback((children: Descendant[]) => {
        if (!isAuthenticated) {
            // Store message in sessionStorage to survive OAuth redirect
            sessionStorage.setItem(PENDING_MESSAGE_KEY, JSON.stringify(children));
            setIsLoginModalOpen(true);
            return;
        }
        createNewChatThread(children, selectedSearchScopes);
    }, [isAuthenticated, createNewChatThread, selectedSearchScopes]);

    // Restore pending message to editor and auto-submit after login
    useEffect(() => {
        if (isAuthenticated && !hasRestoredPendingMessage.current) {
            const stored = sessionStorage.getItem(PENDING_MESSAGE_KEY);
            if (stored) {
                hasRestoredPendingMessage.current = true;
                sessionStorage.removeItem(PENDING_MESSAGE_KEY);
                const message = JSON.parse(stored) as Descendant[];

                // Restore the message content to the editor by replacing all nodes
                // Remove all existing nodes
                while (editor.children.length > 0) {
                    Transforms.removeNodes(editor, { at: [0] });
                }
                // Insert the restored content at the beginning
                Transforms.insertNodes(editor, message, { at: [0] });

                // Allow the UI to render the restored text before auto-submitting
                createNewChatThread(message, selectedSearchScopes);
            }
        }
    }, [isAuthenticated, editor, createNewChatThread, selectedSearchScopes]);

    const imageSrc = imageUrl ? getRepoImageSrc(imageUrl, repoId) : undefined;
    const displayName = repoDisplayName ?? repoName;

    return (
        <div className="min-h-screen flex flex-col justify-between p-4">
            {/* Center Section - Repository Info */}
            <div className="flex-1 flex items-center justify-center">
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
            </div>

            {/* Bottom Section - ChatBox */}
            <div className="flex justify-center pb-8">
                <div className="w-full max-w-[800px]">
                    <div className="border rounded-md w-full shadow-sm">
                        <ChatBox
                            onSubmit={handleSubmit}
                            className="min-h-[50px]"
                            isRedirecting={isLoading}
                            languageModels={languageModels}
                            selectedSearchScopes={selectedSearchScopes}
                            searchContexts={[]}
                            onContextSelectorOpenChanged={setIsContextSelectorOpen}
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
                                    onSelectedSearchScopesChange={() => {}}
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
                isOpen={isLoginModalOpen}
                onOpenChange={setIsLoginModalOpen}
                providers={providers}
                callbackUrl={typeof window !== 'undefined' ? window.location.href : ''}
            />
        </div>
    )
}