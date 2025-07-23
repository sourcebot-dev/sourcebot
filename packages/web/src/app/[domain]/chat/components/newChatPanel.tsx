'use client';

import { ResizablePanel } from "@/components/ui/resizable";
import { ChatBox } from "@/features/chat/components/chatBox";
import { ChatBoxToolbar } from "@/features/chat/components/chatBox/chatBoxToolbar";
import { CustomSlateEditor } from "@/features/chat/customSlateEditor";
import { useCreateNewChatThread } from "@/features/chat/useCreateNewChatThread";
import { LanguageModelInfo } from "@/features/chat/types";
import { RepositoryQuery } from "@/lib/types";
import { useCallback, useState } from "react";
import { Descendant } from "slate";
import { useLocalStorage } from "usehooks-ts";

interface NewChatPanelProps {
    languageModels: LanguageModelInfo[];
    repos: RepositoryQuery[];
    order: number;
}

export const NewChatPanel = ({
    languageModels,
    repos,
    order,
}: NewChatPanelProps) => {
    const [selectedRepos, setSelectedRepos] = useLocalStorage<string[]>("selectedRepos", [], { initializeWithValue: false });
    const { createNewChatThread, isLoading } = useCreateNewChatThread();
    const [isRepoSelectorOpen, setIsRepoSelectorOpen] = useState(false);

    const onSubmit = useCallback((children: Descendant[]) => {
        createNewChatThread(children, selectedRepos);
    }, [createNewChatThread, selectedRepos]);


    return (
        <ResizablePanel
            order={order}
            id="new-chat-panel"
            defaultSize={85}
        >
            <div className="flex flex-col h-full w-full items-center justify-start pt-[20vh]">
                <h2 className="text-4xl font-bold mb-8">What can I help you understand?</h2>
                <div className="border rounded-md w-full max-w-3xl mx-auto mb-8 shadow-sm">
                    <CustomSlateEditor>
                        <ChatBox
                            onSubmit={onSubmit}
                            className="min-h-[80px]"
                            preferredSuggestionsBoxPlacement="bottom-start"
                            isRedirecting={isLoading}
                            languageModels={languageModels}
                            selectedRepos={selectedRepos}
                            onRepoSelectorOpenChanged={setIsRepoSelectorOpen}
                        />
                        <div className="w-full flex flex-row items-center bg-accent rounded-b-md px-2">
                            <ChatBoxToolbar
                                languageModels={languageModels}
                                repos={repos}
                                selectedRepos={selectedRepos}
                                onSelectedReposChange={setSelectedRepos}
                                isRepoSelectorOpen={isRepoSelectorOpen}
                                onRepoSelectorOpenChanged={setIsRepoSelectorOpen}
                            />
                        </div>
                    </CustomSlateEditor>
                </div>
            </div>
        </ResizablePanel>
    )
}