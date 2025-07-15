'use client';

import { getRepos } from "@/actions";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useDomain } from "@/hooks/useDomain";
import { cn, unwrapServiceError } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { AtSignIcon } from "lucide-react";
import { ReactEditor, useSlate } from "slate-react";
import { RepoSelector } from "../repoSelector";
import { RepoIndexingStatus } from "@sourcebot/db";
import { ModelProvider, ModelProviderInfo } from "@/features/chat/types";
import { useCallback, useMemo } from "react";
import anthropicLogo from "@/public/anthropic.svg";
import openaiLogo from "@/public/openai.svg";
import geminiLogo from "@/public/gemini.svg";
import bedrockLogo from "@/public/bedrock.svg";
import Image from "next/image";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { KeyboardShortcutHint } from "@/app/components/keyboardShortcutHint";
import { useHotkeys } from "react-hotkeys-hook";

interface ChatBoxToolsProps {
    selectedRepos: string[];
    onSelectedReposChange: (repos: string[]) => void;
    modelProviderInfo?: ModelProviderInfo;
}

export const ChatBoxTools = ({
    selectedRepos,
    onSelectedReposChange,
    modelProviderInfo,
}: ChatBoxToolsProps) => {
    const domain = useDomain();
    const { data: repos } = useQuery({
        queryKey: ["repos", domain],
        queryFn: () => unwrapServiceError(getRepos(domain, {
            status: [RepoIndexingStatus.INDEXED]
        })),
    });

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
    })

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
                        values={repos?.map((repo) => repo.repoName) ?? []}
                        selectedValues={selectedRepos}
                        onValueChange={onSelectedReposChange}
                    />
                </TooltipTrigger>
                <TooltipContent side="bottom">
                    <span>Scope to selected repositories</span>
                </TooltipContent>
            </Tooltip>
            {!!modelProviderInfo && (
                <>
                    <Separator orientation="vertical" className="h-3 ml-1 mr-2" />
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center">
                                <ModelProviderLogo
                                    provider={modelProviderInfo.provider}
                                    className="mr-1"
                                />
                                <p className="text-sm text-muted-foreground cursor-default">
                                    {modelProviderInfo.displayName ?? modelProviderInfo.model}
                                </p>
                            </div>
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

interface ModelProviderLogoProps {
    provider: ModelProvider;
    className?: string;
}

const ModelProviderLogo = ({
    provider,
    className,
}: ModelProviderLogoProps) => {

    const { src, className: logoClassName } = useMemo(() => {
        switch (provider) {
            case 'aws-bedrock':
                return {
                    src: bedrockLogo,
                    className: 'w-3.5 h-3.5 dark:invert'
                };
            case 'anthropic':
                return {
                    src: anthropicLogo,
                    className: 'dark:invert'
                };
            case 'openai':
                return {
                    src: openaiLogo,
                    className: 'dark:invert w-3.5 h-3.5'
                };
            case 'google-generative-ai':
                return {
                    src: geminiLogo,
                    className: 'w-3.5 h-3.5'
                };
        }
    }, [provider]);

    return (
        <Image
            src={src}
            alt={provider}
            className={cn(
                'w-4 h-4',
                logoClassName,
                className
            )}
        />
    )
}
