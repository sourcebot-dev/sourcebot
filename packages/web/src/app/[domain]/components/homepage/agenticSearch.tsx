'use client';

import { Separator } from "@/components/ui/separator";
import { ChatBox } from "@/features/chat/components/chatBox";
import { ChatBoxToolbar } from "@/features/chat/components/chatBox/chatBoxToolbar";
import { LanguageModelInfo, SearchScope } from "@/features/chat/types";
import { useCreateNewChatThread } from "@/features/chat/useCreateNewChatThread";
import { RepositoryQuery, SearchContextQuery } from "@/lib/types";
import { useCallback, useState } from "react";
import { SearchModeSelector, SearchModeSelectorProps } from "./toolbar";
import { useLocalStorage } from "usehooks-ts";
import { DemoExamples } from "@/types";
import { AskSourcebotDemoCards } from "./askSourcebotDemoCards";
import { AgenticSearchTutorialDialog } from "./agenticSearchTutorialDialog";
import { setAgenticSearchTutorialDismissedCookie } from "@/actions";
import { RepositorySnapshot } from "./repositorySnapshot";

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
    isTutorialDismissed: boolean;
}

export const AgenticSearch = ({
    searchModeSelectorProps,
    languageModels,
    repos,
    searchContexts,
    demoExamples,
    isTutorialDismissed,
}: AgenticSearchProps) => {
    const { createNewChatThread, isLoading } = useCreateNewChatThread();
    const [selectedSearchScopes, setSelectedSearchScopes] = useLocalStorage<SearchScope[]>("selectedSearchScopes", [], { initializeWithValue: false });
    const [isContextSelectorOpen, setIsContextSelectorOpen] = useState(false);

    const [isTutorialOpen, setIsTutorialOpen] = useState(!isTutorialDismissed);
    const onTutorialDismissed = useCallback(() => {
        setIsTutorialOpen(false);
        setAgenticSearchTutorialDismissedCookie(true);
    }, []);

    return (
        <div className="flex flex-col items-center w-full">
            <div className="mt-4 w-full border rounded-md shadow-sm max-w-[800px]">
                <ChatBox
                    onSubmit={(children) => {
                        createNewChatThread(children, selectedSearchScopes);
                    }}
                    className="min-h-[50px]"
                    isRedirecting={isLoading}
                    languageModels={languageModels}
                    selectedSearchScopes={selectedSearchScopes}
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
                            selectedSearchScopes={selectedSearchScopes}
                            onSelectedSearchScopesChange={setSelectedSearchScopes}
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

            <div className="mt-8">
                <RepositorySnapshot
                    repos={repos}
                />
            </div>

            <div className="flex flex-col items-center w-fit gap-6">
                <Separator className="mt-5 w-[700px]" />
            </div>

            {demoExamples && (
                <AskSourcebotDemoCards
                    demoExamples={demoExamples}
                />
            )}

            {isTutorialOpen && (
                <AgenticSearchTutorialDialog
                    onClose={onTutorialDismissed}
                />
            )}
        </div >
    )
}