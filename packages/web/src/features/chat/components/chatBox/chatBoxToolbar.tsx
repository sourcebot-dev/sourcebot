'use client';

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LanguageModelInfo, SearchScope } from "@/features/chat/types";
import { RepositoryQuery, SearchContextQuery } from "@/lib/types";
import { AtSignIcon } from "lucide-react";
import { useCallback } from "react";
import { ReactEditor, useSlate } from "slate-react";
import { useSelectedLanguageModel } from "../../useSelectedLanguageModel";
import { LanguageModelSelector } from "./languageModelSelector";
import { SearchScopeSelector } from "./searchScopeSelector";
import { SearchScopeInfoCard } from "@/features/chat/components/chatBox/searchScopeInfoCard";
import { AtMentionInfoCard } from "@/features/chat/components/chatBox/atMentionInfoCard";

export interface ChatBoxToolbarProps {
    languageModels: LanguageModelInfo[];
    repos: RepositoryQuery[];
    searchContexts: SearchContextQuery[];
    selectedSearchScopes: SearchScope[];
    onSelectedSearchScopesChange: (items: SearchScope[]) => void;
    isContextSelectorOpen: boolean;
    onContextSelectorOpenChanged: (isOpen: boolean) => void;
}

export const ChatBoxToolbar = ({
    languageModels,
    repos,
    searchContexts,
    selectedSearchScopes,
    onSelectedSearchScopesChange,
    isContextSelectorOpen,
    onContextSelectorOpenChanged,
}: ChatBoxToolbarProps) => {
    const editor = useSlate();
    
    const onAddContext = useCallback(() => {
        editor.insertText("@");
        ReactEditor.focus(editor);
    }, [editor]);

    const { selectedLanguageModel, setSelectedLanguageModel } = useSelectedLanguageModel({
        initialLanguageModel: languageModels.length > 0 ? languageModels[0] : undefined,
    });

    return (
        <>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="w-6 h-6 text-muted-foreground hover:text-primary"
                        onClick={onAddContext}
                    >
                        <AtSignIcon className="w-4 h-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="p-0 border-0 bg-transparent shadow-none">
                    <AtMentionInfoCard />
                </TooltipContent>
            </Tooltip>
            <Separator orientation="vertical" className="h-3 mx-1" />
            <Tooltip>
                <TooltipTrigger asChild>
                    <SearchScopeSelector
                        className="bg-inherit w-fit h-6 min-h-6"
                        repos={repos}
                        searchContexts={searchContexts}
                        selectedSearchScopes={selectedSearchScopes}
                        onSelectedSearchScopesChange={onSelectedSearchScopesChange}
                        isOpen={isContextSelectorOpen}
                        onOpenChanged={onContextSelectorOpenChanged}
                    />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="p-0 border-0 bg-transparent shadow-none">
                    <SearchScopeInfoCard />
                </TooltipContent>
            </Tooltip>
            {languageModels.length > 0 && (
                <>
                    <Separator orientation="vertical" className="h-3 ml-1 mr-2" />
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div>
                                <LanguageModelSelector
                                    languageModels={languageModels}
                                    onSelectedModelChange={setSelectedLanguageModel}
                                    selectedModel={selectedLanguageModel}
                                />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <span>Selected language model</span>
                        </TooltipContent>
                    </Tooltip>
                </>
            )}
        </>
    )
}
