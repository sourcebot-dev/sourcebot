'use client';

import { Separator } from "@/components/ui/separator";
import { ChatBox } from "@/features/chat/components/chatBox";
import { ChatBoxToolbar } from "@/features/chat/components/chatBox/chatBoxToolbar";
import { LanguageModelInfo } from "@/features/chat/types";
import { useCreateNewChatThread } from "@/features/chat/useCreateNewChatThread";
import { RepositoryQuery, SearchContextQuery } from "@/lib/types";
import { useState } from "react";
import { SearchModeSelector, SearchModeSelectorProps } from "./toolbar";
import { useLocalStorage } from "usehooks-ts";
import { ContextItem } from "@/features/chat/components/chatBox/contextSelector";
import { DemoExamples } from "@/types";
import { AskSourcebotDemoCards } from "./askSourcebotDemoCards";

interface AgenticSearchProps {
    searchModeSelectorProps: SearchModeSelectorProps;
    languageModels: LanguageModelInfo[];
    repos: RepositoryQuery[];
    searchContexts: SearchContextQuery[];
    chatHistory: {
        id: string;
        createdAt: Date;
        name: string | null;
    }[];
    demoExamples: DemoExamples | undefined;
}

export const AgenticSearch = ({
    searchModeSelectorProps,
    languageModels,
    repos,
    searchContexts,
    demoExamples,
}: AgenticSearchProps) => {
    const { createNewChatThread, isLoading } = useCreateNewChatThread();
    const [selectedItems, setSelectedItems] = useLocalStorage<ContextItem[]>("selectedContextItems", [], { initializeWithValue: false });
    const [isContextSelectorOpen, setIsContextSelectorOpen] = useState(false);

    return (
        <div className="flex flex-col items-center w-full">
            <div className="mt-4 w-full border rounded-md shadow-sm max-w-[800px]">
                <ChatBox
                    onSubmit={(children) => {
                        createNewChatThread(children, selectedItems);
                    }}
                    className="min-h-[50px]"
                    isRedirecting={isLoading}
                    languageModels={languageModels}
                    selectedItems={selectedItems}
                    searchContexts={searchContexts}
                    onContextSelectorOpenChanged={setIsContextSelectorOpen}
                />
                <Separator />
                <div className="relative">
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
                        <SearchModeSelector
                            {...searchModeSelectorProps}
                            className="ml-auto"
                        />
                    </div>
                </div>
            </div>

            {demoExamples && (
                <AskSourcebotDemoCards
                    demoExamples={demoExamples}
                    selectedItems={selectedItems}
                    setSelectedItems={setSelectedItems}
                    searchContexts={searchContexts}
                    repos={repos}
                />
            )}
        </div >
    )
}