'use client';

import { KeyboardShortcutHint } from "@/app/components/keyboardShortcutHint";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LanguageModelInfo } from "@/features/chat/types";
import { RepositoryQuery } from "@/lib/types";
import { AtSignIcon } from "lucide-react";
import { useCallback } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { ReactEditor, useSlate } from "slate-react";
import { useSelectedLanguageModel } from "../../useSelectedLanguageModel";
import { LanguageModelSelector } from "./languageModelSelector";
import { RepoSelector } from "./repoSelector";

export interface ChatBoxToolbarProps {
    languageModels: LanguageModelInfo[];
    repos: RepositoryQuery[];
    selectedRepos: string[];
    onSelectedReposChange: (repos: string[]) => void;
}

export const ChatBoxToolbar = ({
    languageModels,
    repos,
    selectedRepos,
    onSelectedReposChange,
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

    const { selectedLanguageModel, setSelectedLanguageModel } = useSelectedLanguageModel();

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
                    <RepoSelector
                        className="bg-inherit w-fit h-6 min-h-6"
                        repos={repos.map((repo) => repo.repoName)}
                        selectedRepos={selectedRepos}
                        onSelectedReposChange={onSelectedReposChange}
                    />
                </TooltipTrigger>
                <TooltipContent side="bottom">
                    <span>Scope to selected repositories</span>
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
