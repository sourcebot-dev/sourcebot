'use client';

import { KeyboardShortcutHint } from "@/app/components/keyboardShortcutHint";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LanguageModelInfo, RepoMentionData } from "@/features/chat/types";
import { insertMention, isMentionElement } from "@/features/chat/utils";
import { RepositoryQuery } from "@/lib/types";
import { AtSignIcon } from "lucide-react";
import { useCallback } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { Descendant, Transforms } from "slate";
import { ReactEditor, useSlate } from "slate-react";
import { useRepoMentions } from "../../useRepoMentions";
import { useSelectedLanguageModel } from "../../useSelectedLanguageModel";
import { LanguageModelSelector } from "./languageModelSelector";
import { RepoSelector } from "./repoSelector";

export interface ChatBoxToolbarProps {
    languageModels: LanguageModelInfo[];
    repos: RepositoryQuery[];
}

export const ChatBoxToolbar = ({
    languageModels,
    repos,
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

    const selectedRepos = useRepoMentions();
    const { selectedLanguageModel, setSelectedLanguageModel } = useSelectedLanguageModel();

    const onSelectedReposChange = useCallback((repos: RepoMentionData[]) => {
        const addedRepos = repos.filter((repo) => !selectedRepos.some((selectedRepo) => selectedRepo.name === repo.name));
        const removedRepos = selectedRepos.filter((repo) => !repos.some((selectedRepo) => selectedRepo.name === repo.name));

        addedRepos.forEach((repo) => {
            console.log('adding repo', repo);
            insertMention(editor, {
                type: 'repo',
                name: repo.name,
                displayName: repo.displayName,
                codeHostType: repo.codeHostType,
            })
        });

        Transforms.removeNodes(editor, {
            at: [],
            match: (node) => {
                const descendant = node as Descendant;
                return isMentionElement(descendant) &&
                    descendant.data.type === 'repo' &&
                    removedRepos.some((repo) => repo.name === descendant.data.name);
            }
        });

    }, [editor, selectedRepos]);

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
                        repos={repos?.map((repo) => ({
                            type: 'repo',
                            name: repo.repoName,
                            displayName: repo.repoDisplayName,
                            codeHostType: repo.codeHostType,
                        })) ?? []}
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
                            <LanguageModelSelector
                                languageModels={languageModels}
                                onSelectedModelChange={setSelectedLanguageModel}
                                selectedModel={selectedLanguageModel}
                            />
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <span>Configured language model</span>
                        </TooltipContent>
                    </Tooltip>
                </>
            )}
        </>
    )
}
