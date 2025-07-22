'use client';

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ChatBox } from "@/features/chat/components/chatBox";
import { useCreateNewChatThread } from "@/features/chat/useCreateNewChatThread";
import { FileIcon, LucideIcon, SearchCodeIcon, SearchIcon } from "lucide-react";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { SearchModeSelector, SearchModeSelectorProps } from "./toolbar";
import { ReactEditor, useSlate } from "slate-react";
import { resetEditor } from "@/features/chat/utils";
import { ChatBoxToolbar, ChatBoxToolbarProps } from "@/features/chat/components/chatBox/chatBoxToolbar";
import { getDisplayTime } from "@/lib/utils";
import { useDomain } from "@/hooks/useDomain";
import Link from "next/link";

// @todo: we should probably rename this to a different type since it sort-of clashes
// with the Suggestion system we have built into the chat box.
type SuggestionType = "understand" | "find" | "summarize";

const suggestionTypes: Record<SuggestionType, {
    icon: LucideIcon;
    title: string;
    description: string;
}> = {
    understand: {
        icon: SearchCodeIcon,
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
}[]> = {
    understand: [
        {
            queryText: "How does authentication work in this codebase? @repo:",
            queryNode: <span>How does authentication work in this codebase? <Highlight>@repo:</Highlight></span>,
        },
    ],
    find: [
        {
            queryText: "todo",
        },
    ],
    summarize: [
        {
            queryText: "todo",
        },
    ],
}

const MAX_RECENT_CHAT_HISTORY_COUNT = 10;


interface AgenticSearchProps {
    searchModeSelectorProps: SearchModeSelectorProps;
    chatBoxToolbarProps: Omit<ChatBoxToolbarProps, "selectedRepos" | "onSelectedReposChange">;
    chatHistory: {
        id: string;
        createdAt: Date;
        name: string | null;
    }[];
}

export const AgenticSearch = ({
    searchModeSelectorProps,
    chatBoxToolbarProps,
    chatHistory,
}: AgenticSearchProps) => {
    const [selectedSuggestionType, _setSelectedSuggestionType] = useState<SuggestionType | undefined>(undefined);
    const { createNewChatThread, isLoading } = useCreateNewChatThread();
    const dropdownRef = useRef<HTMLDivElement>(null);
    const editor = useSlate();
    const [selectedRepos, setSelectedRepos] = useState<string[]>([]);
    const domain = useDomain();

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
                    languageModels={chatBoxToolbarProps.languageModels}
                />
                <Separator />
                <div className="relative">
                    <div className="w-full flex flex-row items-center bg-accent rounded-b-md px-2">
                        <ChatBoxToolbar
                            {...chatBoxToolbarProps}
                            selectedRepos={selectedRepos}
                            onSelectedReposChange={setSelectedRepos}
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
                            {suggestions[selectedSuggestionType].map(({ queryText, queryNode }, index) => (
                                <div
                                    key={index}
                                    className="flex flex-row items-center gap-2 cursor-pointer hover:bg-muted rounded-md px-1 py-0.5"
                                    onClick={() => {
                                        resetEditor(editor);
                                        editor.insertText(queryText);
                                        setSelectedSuggestionType(undefined);
                                        ReactEditor.focus(editor);
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
