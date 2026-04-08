"use client";

import { ChatActionsDropdown } from "@/app/(app)/chat/components/chatActionsDropdown";
import { DeleteChatDialog } from "@/app/(app)/chat/components/deleteChatDialog";
import { DuplicateChatDialog } from "@/app/(app)/chat/components/duplicateChatDialog";
import { RenameChatDialog } from "@/app/(app)/chat/components/renameChatDialog";
import { useToast } from "@/components/hooks/use-toast";
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { deleteChat, duplicateChat, updateChatName } from "@/features/chat/actions";
import { captureEvent } from "@/hooks/useCaptureEvent";
import { isServiceError } from "@/lib/utils";
import { EllipsisIcon, MessagesSquareIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export interface ChatHistoryItem {
    id: string;
    name: string | null;
    createdAt: Date;
}

interface ChatHistoryProps {
    chatHistory: ChatHistoryItem[];
    hasMore?: boolean;
}

export function ChatHistory({ chatHistory, hasMore }: ChatHistoryProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { toast } = useToast();

    const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
    const [chatIdToRename, setChatIdToRename] = useState<string | null>(null);
    const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
    const [chatIdToDuplicate, setChatIdToDuplicate] = useState<string | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [chatIdToDelete, setChatIdToDelete] = useState<string | null>(null);

    const onRenameChat = useCallback(async (name: string, chatId: string): Promise<boolean> => {
        const response = await updateChatName({ chatId, name });
        if (isServiceError(response)) {
            toast({ description: `Failed to rename chat. Reason: ${response.message}` });
            return false;
        }
        toast({ description: "Chat renamed successfully" });
        captureEvent('wa_chat_renamed', { chatId });
        router.refresh();
        return true;
    }, [router, toast]);

    const onDeleteChat = useCallback(async (chatIdToDelete: string): Promise<boolean> => {
        const response = await deleteChat({ chatId: chatIdToDelete });
        if (isServiceError(response)) {
            toast({ description: `Failed to delete chat. Reason: ${response.message}` });
            return false;
        }
        toast({ description: "Chat deleted successfully" });
        captureEvent('wa_chat_deleted', { chatId: chatIdToDelete });
        if (pathname === `/chat/${chatIdToDelete}`) {
            router.push("/chat");
        } else {
            router.refresh();
        }
        return true;
    }, [pathname, router, toast]);

    const onDuplicateChat = useCallback(async (newName: string, chatIdToDuplicate: string): Promise<string | null> => {
        const response = await duplicateChat({ chatId: chatIdToDuplicate, newName });
        if (isServiceError(response)) {
            toast({ description: `Failed to duplicate chat. Reason: ${response.message}` });
            return null;
        }
        toast({ description: "Chat duplicated successfully" });
        captureEvent('wa_chat_duplicated', { chatId: chatIdToDuplicate });
        router.push(`/chat/${response.id}`);
        return response.id;
    }, [router, toast]);

    if (chatHistory.length === 0) {
        return null;
    }

    return (
        <>
            <SidebarGroup className="group-data-[state=collapsed]:hidden">
                <SidebarGroupLabel className="text-muted-foreground whitespace-nowrap">Recent Chats</SidebarGroupLabel>
                <SidebarGroupContent>
                    <SidebarMenu>
                        {chatHistory.map((chat) => (
                            <SidebarMenuItem key={chat.id} className="group/chat">
                                <SidebarMenuButton
                                    asChild
                                    isActive={pathname === `/chat/${chat.id}`}
                                >
                                    <Link href={`/chat/${chat.id}`}>
                                        <span>{chat.name ?? "Untitled chat"}</span>
                                    </Link>
                                </SidebarMenuButton>
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
                                    <SidebarMenuAction className="opacity-0 group-hover/chat:opacity-100 transition-opacity">
                                        <EllipsisIcon className="w-4 h-4" />
                                    </SidebarMenuAction>
                                </ChatActionsDropdown>
                            </SidebarMenuItem>
                        ))}
                        {hasMore && (
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild>
                                    <Link href="/chats">
                                        <MessagesSquareIcon className="h-4 w-4" />
                                        <span>All chats</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        )}
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
            <RenameChatDialog
                isOpen={isRenameDialogOpen}
                onOpenChange={setIsRenameDialogOpen}
                onRename={async (name) => {
                    if (chatIdToRename) {
                        return await onRenameChat(name, chatIdToRename);
                    }
                    return false;
                }}
                currentName={chatHistory.find((chat) => chat.id === chatIdToRename)?.name ?? "Untitled chat"}
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
                currentName={chatHistory.find((chat) => chat.id === chatIdToDuplicate)?.name ?? "Untitled chat"}
            />
        </>
    );
}
