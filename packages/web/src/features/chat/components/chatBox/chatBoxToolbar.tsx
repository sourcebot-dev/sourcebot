'use client';

import { KeyboardShortcutHint } from "@/app/components/keyboardShortcutHint";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LanguageModelInfo } from "@/features/chat/types";
import { RepositoryQuery, SearchContextQuery } from "@/lib/types";
import { AtSignIcon } from "lucide-react";
import { useCallback } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { ReactEditor, useSlate } from "slate-react";
import { useSelectedLanguageModel } from "../../useSelectedLanguageModel";
import { LanguageModelSelector } from "./languageModelSelector";
import { ContextSelector, type ContextItem } from "./contextSelector";
import { SearchScopeInfoCard } from "@/components/searchScopeInfoCard";

export interface ChatBoxToolbarProps {
    languageModels: LanguageModelInfo[];
    repos: RepositoryQuery[];
    searchContexts: SearchContextQuery[];
    selectedItems: ContextItem[];
    onSelectedItemsChange: (items: ContextItem[]) => void;
    isContextSelectorOpen: boolean;
    onContextSelectorOpenChanged: (isOpen: boolean) => void;
}

export const ChatBoxToolbar = ({
    languageModels,
    repos,
    searchContexts,
    selectedItems,
    onSelectedItemsChange,
    isContextSelectorOpen,
    onContextSelectorOpenChanged,
}: ChatBoxToolbarProps) => {
    const editor = useSlate();
    
    const onAddContext = useCallback(() => {
        editor.insertText("@");
        ReactEditor.focus(editor);
    }, [editor]);

    useHotkeys("alt+mod+p", (e) => {
        e.preventDefault();
        onAddContext();
    }, {
        enableOnFormTags: true,
        enableOnContentEditable: true,
        description: "Add context", 
    });

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
                <TooltipContent
                    side="bottom"
                    className="flex flex-row items-center gap-2"
                >
                    <KeyboardShortcutHint shortcut="⌥ ⌘ P" />
                    <Separator orientation="vertical" className="h-4" />
                    <span>Add context</span>
                </TooltipContent>
            </Tooltip>
            <Separator orientation="vertical" className="h-3 mx-1" />
            <Tooltip>
                <TooltipTrigger asChild>
                    <ContextSelector
                        className="bg-inherit w-fit h-6 min-h-6"
                        repos={repos}
                        searchContexts={searchContexts}
                        selectedItems={selectedItems}
                        onSelectedItemsChange={onSelectedItemsChange}
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
