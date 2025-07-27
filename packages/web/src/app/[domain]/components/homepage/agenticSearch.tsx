'use client';

import { Separator } from "@/components/ui/separator";
import { ChatBox } from "@/features/chat/components/chatBox";
import { ChatBoxToolbar } from "@/features/chat/components/chatBox/chatBoxToolbar";
import { LanguageModelInfo } from "@/features/chat/types";
import { useCreateNewChatThread } from "@/features/chat/useCreateNewChatThread";
import { RepositoryQuery, SearchContextQuery } from "@/lib/types";
import { Layers, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { SearchModeSelector, SearchModeSelectorProps } from "./toolbar";
import { Card } from "@/components/ui/card";
import { CardContent } from "@/components/ui/card";
import { useLocalStorage } from "usehooks-ts";
import { ContextItem } from "@/features/chat/components/chatBox/contextSelector";
import { DemoExamples, DemoSearchExample, DemoSearchContextExample } from "@/types";

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

    const handleExampleClick = (example: DemoSearchExample) => {
        console.log(example);
    }

    const handleContextClick = (context: DemoSearchContextExample) => {
        console.log(context);
    }

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
                <div className="w-full mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8 px-4 max-w-[1200px]">
                    {/* Example Searches Column */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-6">
                            <Search className="h-5 w-5 text-muted-foreground" />
                            <h3 className="text-lg font-semibold">Example Searches</h3>
                        </div>
                        <div className="space-y-3">
                            {demoExamples.searchExamples.map((example) => (
                                <Card
                                    key={example.id}
                                    className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/50 group"
                                    onClick={() => handleExampleClick(example)}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="flex-shrink-0 p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                                {example.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-medium text-sm mb-1 group-hover:text-primary transition-colors">
                                                    {example.title}
                                                </h4>
                                                <p className="text-xs text-muted-foreground mb-2">{example.description}</p>
                                                <Badge className="text-xs">
                                                    {example.category}
                                                </Badge>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>

                    {/* Search Contexts Column */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-6">
                            <Layers className="h-5 w-5 text-muted-foreground" />
                            <h3 className="text-lg font-semibold">Search Contexts</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
                            {demoExamples.searchContextExamples.map((context) => {
                                const searchContext = searchContexts.find((item) => item.name === context.name);
                                if (!searchContext) return null;
                                const isSelected = false; //selectedItems.some((item) => item.id === context.id)

                                const numRepos = searchContext.repoNames.length;
                                return (
                                    <Card
                                        key={context.id}
                                        className={`cursor-pointer transition-all duration-200 hover:shadow-md group ${isSelected ? "border-primary bg-primary/5 shadow-sm" : "hover:border-primary/50"
                                            }`}
                                        onClick={() => handleContextClick(context)}
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex items-start gap-3">
                                                <div
                                                    className={`flex-shrink-0 p-2 rounded-lg ${context.color} transition-transform group-hover:scale-105`}
                                                >
                                                    {context.icon}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4
                                                        className={`font-medium text-sm mb-1 transition-colors ${isSelected ? "text-primary" : "group-hover:text-primary"
                                                            }`}
                                                    >
                                                        {context.displayName}
                                                    </h4>
                                                    <p className="text-xs text-muted-foreground mb-2">{context.description}</p>
                                                    <Badge className="text-xs">
                                                        {numRepos} repos
                                                    </Badge>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div >
    )
}