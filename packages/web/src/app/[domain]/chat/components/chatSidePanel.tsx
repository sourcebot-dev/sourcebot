'use client';

import { KeyboardShortcutHint } from "@/app/components/keyboardShortcutHint";
import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ResizablePanel } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { deleteChat, duplicateChat, updateChatName } from "@/features/chat/actions";
import { captureEvent } from "@/hooks/useCaptureEvent";
import { cn, isServiceError } from "@/lib/utils";
import { CirclePlusIcon, EllipsisIcon } from "lucide-react";
import { ChatActionsDropdown } from "./chatActionsDropdown";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import {
    GoSidebarCollapse as ExpandIcon,
} from "react-icons/go";
import { ImperativePanelHandle } from "react-resizable-panels";
import { useChatId } from "../useChatId";
import { RenameChatDialog } from "./renameChatDialog";
import { DeleteChatDialog } from "./deleteChatDialog";
import { DuplicateChatDialog } from "./duplicateChatDialog";
import Link from "next/link";
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants";

interface ChatSidePanelProps {
    order: number;
    chatHistory: {
        id: string;
        name: string | null;
        createdAt: Date;
    }[];
    isAuthenticated: boolean;
    isCollapsedInitially: boolean;
}

export const ChatSidePanel = ({
    order,
    chatHistory,
    isAuthenticated,
    isCollapsedInitially,
}: ChatSidePanelProps) => {
    const [isCollapsed, setIsCollapsed] = useState(isCollapsedInitially);
    const sidePanelRef = useRef<ImperativePanelHandle>(null);
    const router = useRouter();
    const { toast } = useToast();
    const chatId = useChatId();
    const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
    const [chatIdToRename, setChatIdToRename] = useState<string | null>(null);
    const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
    const [chatIdToDuplicate, setChatIdToDuplicate] = useState<string | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [chatIdToDelete, setChatIdToDelete] = useState<string | null>(null);

    useHotkeys("mod+b", () => {
        if (isCollapsed) {
            sidePanelRef.current?.expand();
        } else {
            sidePanelRef.current?.collapse();
        }
    }, {
        enableOnFormTags: true,
        enableOnContentEditable: true,
        description: "Toggle side panel",
    });

    const onRenameChat = useCallback(async (name: string, chatId: string): Promise<boolean> => {
        if (!chatId) {
            return false;
        }

        const response = await updateChatName({
            chatId,
            name: name,
        });

        if (isServiceError(response)) {
            toast({
                description: `❌ Failed to rename chat. Reason: ${response.message}`
            });
            return false;
        } else {
            toast({
                description: `✅ Chat renamed successfully`
            });
            captureEvent('wa_chat_renamed', { chatId });
            router.refresh();
            return true;
        }
    }, [router, toast]);

    const onDeleteChat = useCallback(async (chatIdToDelete: string): Promise<boolean> => {
        if (!chatIdToDelete) {
            return false;
        }

        const response = await deleteChat({ chatId: chatIdToDelete });

        if (isServiceError(response)) {
            toast({
                description: `❌ Failed to delete chat. Reason: ${response.message}`
            });
            return false;
        } else {
            toast({
                description: `✅ Chat deleted successfully`
            });
            captureEvent('wa_chat_deleted', { chatId: chatIdToDelete });

            // If we just deleted the current chat, navigate to new chat
            if (chatIdToDelete === chatId) {
                router.push(`/${SINGLE_TENANT_ORG_DOMAIN}/chat`);
            }

            router.refresh();
            return true;
        }
    }, [chatId, router, toast]);

    const onDuplicateChat = useCallback(async (newName: string, chatIdToDuplicate: string): Promise<string | null> => {
        if (!chatIdToDuplicate) {
            return null;
        }

        const response = await duplicateChat({ chatId: chatIdToDuplicate, newName });

        if (isServiceError(response)) {
            toast({
                description: `❌ Failed to duplicate chat. Reason: ${response.message}`
            });
            return null;
        } else {
            toast({
                description: `✅ Chat duplicated successfully`
            });
            captureEvent('wa_chat_duplicated', { chatId: chatIdToDuplicate });
            router.push(`/${SINGLE_TENANT_ORG_DOMAIN}/chat/${response.id}`);
            return response.id;
        }
    }, [router, toast]);

    return (
        <>
            <ResizablePanel
                ref={sidePanelRef}
                order={order}
                minSize={10}
                maxSize={15}
                defaultSize={isCollapsed ? 0 : 15}
                collapsible={true}
                id="chat-side-panel"
                onCollapse={() => setIsCollapsed(true)}
                onExpand={() => setIsCollapsed(false)}
            >
                <div className="flex flex-col h-full py-4">
                    <div className="px-2.5 mb-4">
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                                router.push(`/${SINGLE_TENANT_ORG_DOMAIN}/chat`);
                            }}
                        >
                            <CirclePlusIcon className="w-4 h-4 mr-1" />
                            New Chat
                        </Button>
                    </div>
                    <ScrollArea className="flex flex-col h-full px-2.5">
                        <p className="text-sm font-medium mb-4">Recent Chats</p>
                        <div className="flex flex-col gap-1">
                            {!isAuthenticated ? (
                                <div className="flex flex-col">
                                    <p className="text-sm text-muted-foreground mb-4">
                                        <Link
                                            href={`/login?callbackUrl=${encodeURIComponent(`/${SINGLE_TENANT_ORG_DOMAIN}/chat`)}`}
                                            className="text-sm text-link hover:underline cursor-pointer"
                                        >
                                            Sign in
                                        </Link> to access your chat history.
                                    </p>
                                </div>
                            ) : chatHistory.length === 0 ? (
                                <div className="mx-auto w-full h-52 border border-dashed border-muted-foreground rounded-md flex items-center justify-center p-6">
                                    <p className="text-sm text-muted-foreground text-center">Recent chats will appear here.</p>
                                </div>
                            ) : chatHistory.map((chat) => (
                                <div
                                    key={chat.id}
                                    className={cn("group flex flex-row items-center justify-between hover:bg-muted rounded-md px-2 py-1.5 cursor-pointer",
                                        chat.id === chatId && "bg-muted"
                                    )}
                                    onClick={() => {
                                        router.push(`/${SINGLE_TENANT_ORG_DOMAIN}/chat/${chat.id}`);
                                    }}
                                >
                                    <span className="text-sm truncate">{chat.name ?? 'Untitled chat'}</span>
                                    <ChatActionsDropdown
                                        onRenameClick={() => {
                                            setChatIdToRename(chat.id);
                                            setIsRenameDialogOpen(true);
                                        }}
                                        onDuplicateClick={() => {
                                            setChatIdToDuplicate(chat.id);
                                            setIsDuplicateDialogOpen(true);
                                        }}
                                        onDeleteClick={() => {
                                            setChatIdToDelete(chat.id);
                                            setIsDeleteDialogOpen(true);
                                        }}
                                    >
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 z-10 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted-accent"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                            }}
                                        >
                                            <EllipsisIcon className="w-4 h-4" />
                                        </Button>
                                    </ChatActionsDropdown>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>

            </ResizablePanel >
            {isCollapsed && (
                <div className="flex flex-col items-center h-full p-2">
                    <Tooltip
                        delayDuration={100}
                    >
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                    sidePanelRef.current?.expand();
                                }}
                            >
                                <ExpandIcon className="w-4 h-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="flex flex-row items-center gap-2">
                            <KeyboardShortcutHint shortcut="mod+b" />
                            <Separator orientation="vertical" className="h-4" />
                            <span>Open side panel</span>
                        </TooltipContent>
                    </Tooltip>
                </div>
            )}
            <RenameChatDialog
                isOpen={isRenameDialogOpen}
                onOpenChange={setIsRenameDialogOpen}
                onRename={async (name) => {
                    if (chatIdToRename) {
                        return await onRenameChat(name, chatIdToRename);
                    }
                    return false;
                }}
                currentName={chatHistory?.find((chat) => chat.id === chatIdToRename)?.name ?? "Untitled chat"}
            />
            <DeleteChatDialog
                isOpen={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                onDelete={async () => {
                    if (chatIdToDelete) {
                        return await onDeleteChat(chatIdToDelete);
                    }
                    return false;
                }}
            />
            <DuplicateChatDialog
                isOpen={isDuplicateDialogOpen}
                onOpenChange={setIsDuplicateDialogOpen}
                onDuplicate={async (newName) => {
                    if (chatIdToDuplicate) {
                        return await onDuplicateChat(newName, chatIdToDuplicate);
                    }
                    return null;
                }}
                currentName={chatHistory?.find((chat) => chat.id === chatIdToDuplicate)?.name ?? "Untitled chat"}
            />
        </>
    )
}
