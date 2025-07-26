'use client';

import { ResizablePanel } from "@/components/ui/resizable";
import { ChatBox } from "@/features/chat/components/chatBox";
import { ChatBoxToolbar } from "@/features/chat/components/chatBox/chatBoxToolbar";
import { CustomSlateEditor } from "@/features/chat/customSlateEditor";
import { useCreateNewChatThread } from "@/features/chat/useCreateNewChatThread";
import { LanguageModelInfo } from "@/features/chat/types";
import { RepositoryQuery, SearchContextQuery } from "@/lib/types";
import { useCallback, useState } from "react";
import { Descendant } from "slate";
import { useLocalStorage } from "usehooks-ts";
import { ContextItem } from "@/features/chat/components/chatBox/contextSelector";

interface NewChatPanelProps {
    languageModels: LanguageModelInfo[];
    repos: RepositoryQuery[];
    searchContexts: SearchContextQuery[];
    order: number;
}

export const NewChatPanel = ({
    languageModels,
    repos,
    searchContexts,
    order,
}: NewChatPanelProps) => {
    const [selectedItems, setSelectedItems] = useLocalStorage<ContextItem[]>("selectedContextItems", [], { initializeWithValue: false });
    const { createNewChatThread, isLoading } = useCreateNewChatThread();
    const [isContextSelectorOpen, setIsContextSelectorOpen] = useState(false);

    const onSubmit = useCallback((children: Descendant[]) => {
        createNewChatThread(children, selectedItems);
    }, [createNewChatThread, selectedItems]);


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
                            selectedItems={selectedItems}
                            searchContexts={searchContexts}
                            onContextSelectorOpenChanged={setIsContextSelectorOpen}
                        />
                        <div className="w-full flex flex-row items-center bg-accent rounded-b-md px-2">
                            <ChatBoxToolbar
                                languageModels={languageModels}
                                repos={repos}
                                searchContexts={searchContexts}
                                selectedItems={selectedItems}
                                onSelectedItemsChange={setSelectedItems}
                                isContextSelectorOpen={isContextSelectorOpen}
                                onContextSelectorOpenChanged={setIsContextSelectorOpen}
                            />
                        </div>
                    </CustomSlateEditor>
                </div>
            </div>
        </ResizablePanel>
    )
}