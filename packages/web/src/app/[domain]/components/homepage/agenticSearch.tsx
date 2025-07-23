'use client';

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ChatBox } from "@/features/chat/components/chatBox";
import { ChatBoxToolbar } from "@/features/chat/components/chatBox/chatBoxToolbar";
import { LanguageModelInfo } from "@/features/chat/types";
import { useCreateNewChatThread } from "@/features/chat/useCreateNewChatThread";
import { resetEditor } from "@/features/chat/utils";
import { useDomain } from "@/hooks/useDomain";
import { RepositoryQuery } from "@/lib/types";
import { getDisplayTime } from "@/lib/utils";
import { BrainIcon, FileIcon, LucideIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ReactEditor, useSlate } from "slate-react";
import { SearchModeSelector, SearchModeSelectorProps } from "./toolbar";
import { useLocalStorage } from "usehooks-ts";

// @todo: we should probably rename this to a different type since it sort-of clashes
// with the Suggestion system we have built into the chat box.
type SuggestionType = "understand" | "find" | "summarize";

const suggestionTypes: Record<SuggestionType, {
    icon: LucideIcon;
    title: string;
    description: string;
}> = {
    understand: {
        icon: BrainIcon,
        title: "Understand",
        description: "Understand the codebase",
    },
    find: {
        icon: SearchIcon,
        title: "Find",
        description: "Find the codebase",
    },
    summarize: {
        icon: FileIcon,
        title: "Summarize",
        description: "Summarize the codebase",
    },
}


const Highlight = ({ children }: { children: React.ReactNode }) => {
    return (
        <span className="text-highlight">
            {children}
        </span>
    )
}

const suggestions: Record<SuggestionType, {
    queryText: string;
    queryNode?: ReactNode;
    openRepoSelector?: boolean;
}[]> = {
    understand: [
        {
            queryText: "How does authentication work in this codebase?",
            openRepoSelector: true,
        },
        {
            queryText: "How are API endpoints structured and organized?",
            openRepoSelector: true,
        },
        {
            queryText: "How does the build and deployment process work?",
            openRepoSelector: true,
        },
        {
            queryText: "How is error handling implemented across the application?",
            openRepoSelector: true,
        },
    ],
    find: [
        {
            queryText: "Find examples of different logging libraries used throughout the codebase.",
        },
        {
            queryText: "Find examples of potential security vulnerabilities or authentication issues.",
        },
        {
            queryText: "Find examples of API endpoints and route handlers.",
        }
    ],
    summarize: [
        {
            queryText: "Summarize the purpose of this file @file:",
            queryNode: <span>Summarize the purpose of this file <Highlight>@file:</Highlight></span>
        },
        {
            queryText: "Summarize the project structure and architecture.",
            openRepoSelector: true,
        },
        {
            queryText: "Provide a quick start guide for ramping up on this codebase.",
            openRepoSelector: true,
        }
    ],
}

const MAX_RECENT_CHAT_HISTORY_COUNT = 10;


interface AgenticSearchProps {
    searchModeSelectorProps: SearchModeSelectorProps;
    languageModels: LanguageModelInfo[];
    repos: RepositoryQuery[];
    chatHistory: {
        id: string;
        createdAt: Date;
        name: string | null;
    }[];
}

export const AgenticSearch = ({
    searchModeSelectorProps,
    languageModels,
    repos,
    chatHistory,
}: AgenticSearchProps) => {
    const [selectedSuggestionType, _setSelectedSuggestionType] = useState<SuggestionType | undefined>(undefined);
    const { createNewChatThread, isLoading } = useCreateNewChatThread();
    const dropdownRef = useRef<HTMLDivElement>(null);
    const editor = useSlate();
    const [selectedRepos, setSelectedRepos] = useLocalStorage<string[]>("selectedRepos", []);
    const domain = useDomain();
    const [isRepoSelectorOpen, setIsRepoSelectorOpen] = useState(false);

    const setSelectedSuggestionType = useCallback((type: SuggestionType | undefined) => {
        _setSelectedSuggestionType(type);
        if (type) {
            ReactEditor.focus(editor);
        }
    }, [editor, _setSelectedSuggestionType]);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                !dropdownRef.current?.contains(event.target as Node)
            ) {
                setSelectedSuggestionType(undefined);
            }
        }

        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [setSelectedSuggestionType]);

    return (
        <div className="flex flex-col items-center w-full max-w-[800px]">
            <div
                className="mt-4 w-full border rounded-md shadow-sm"
            >
                <ChatBox
                    onSubmit={(children) => {
                        createNewChatThread(children, selectedRepos);
                    }}
                    className="min-h-[50px]"
                    isRedirecting={isLoading}
                    languageModels={languageModels}
                    selectedRepos={selectedRepos}
                    onRepoSelectorOpenChanged={setIsRepoSelectorOpen}
                />
                <Separator />
                <div className="relative">
                    <div className="w-full flex flex-row items-center bg-accent rounded-b-md px-2">
                        <ChatBoxToolbar
                            languageModels={languageModels}
                            repos={repos}
                            selectedRepos={selectedRepos}
                            onSelectedReposChange={setSelectedRepos}
                            isRepoSelectorOpen={isRepoSelectorOpen}
                            onRepoSelectorOpenChanged={setIsRepoSelectorOpen}
                        />
                        <SearchModeSelector
                            {...searchModeSelectorProps}
                            className="ml-auto"
                        />
                    </div>

                    {selectedSuggestionType && (
                        <div
                            ref={dropdownRef}
                            className="w-full absolute top-10 z-10 drop-shadow-2xl bg-background border rounded-md p-2"
                        >
                            <p className="text-muted-foreground text-sm mb-2">
                                {suggestionTypes[selectedSuggestionType].title}
                            </p>
                            {suggestions[selectedSuggestionType].map(({ queryText, queryNode, openRepoSelector }, index) => (
                                <div
                                    key={index}
                                    className="flex flex-row items-center gap-2 cursor-pointer hover:bg-muted rounded-md px-1 py-0.5"
                                    onClick={() => {
                                        resetEditor(editor);
                                        editor.insertText(queryText);
                                        setSelectedSuggestionType(undefined);

                                        if (openRepoSelector) {
                                            setIsRepoSelectorOpen(true);
                                        } else {
                                            ReactEditor.focus(editor);
                                        }
                                    }}
                                >
                                    <SearchIcon className="w-4 h-4" />
                                    {queryNode ?? queryText}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div className="flex flex-col items-center w-fit gap-6 mt-8 relative">
                <div className="flex flex-row items-center gap-4">
                    {Object.entries(suggestionTypes).map(([type, suggestion], index) => (
                        <ExampleButton
                            key={index}
                            Icon={suggestion.icon}
                            title={suggestion.title}
                            onClick={() => {
                                setSelectedSuggestionType(type as SuggestionType);
                            }}
                        />
                    ))}
                </div>
            </div>
            {chatHistory.length > 0 && (
                <div className="flex flex-col items-center w-[80%]">
                    <Separator className="my-6" />
                    <span className="font-semibold mb-2">Recent conversations</span>
                    <div
                        className="flex flex-col gap-1 w-full"
                    >
                        {chatHistory
                            .slice(0, MAX_RECENT_CHAT_HISTORY_COUNT)
                            .map((chat) => (
                                <Link
                                    key={chat.id}
                                    className="flex flex-row items-center justify-between gap-1 w-full rounded-md hover:bg-muted px-2 py-0.5 cursor-pointer group"
                                    href={`/${domain}/chat/${chat.id}`}
                                >
                                    <span className="text-sm text-muted-foreground group-hover:text-foreground">
                                        {chat.name ?? "Untitled Chat"}
                                    </span>
                                    <span className="text-sm text-muted-foreground group-hover:text-foreground">
                                        {getDisplayTime(chat.createdAt)}
                                    </span>
                                </Link>
                            ))}
                    </div>
                    {chatHistory.length > MAX_RECENT_CHAT_HISTORY_COUNT && (
                        <Link
                            href={`/${domain}/chat`}
                            className="text-sm text-link hover:underline mt-6"
                        >
                            View all
                        </Link>
                    )}
                </div>
            )}
        </div>
    )
}


interface ExampleButtonProps {
    Icon: LucideIcon;
    title: string;
    onClick: () => void;
}

const ExampleButton = ({
    Icon,
    title,
    onClick,
}: ExampleButtonProps) => {
    return (
        <Button
            variant="secondary"
            onClick={onClick}
            className="h-9"
        >
            <Icon className="w-4 h-4" />
            {title}
        </Button>
    )
}
