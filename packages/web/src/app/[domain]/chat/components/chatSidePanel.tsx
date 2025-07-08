'use client';

import { KeyboardShortcutHint } from "@/app/components/keyboardShortcutHint";
import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ResizablePanel } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getRecentChats, updateChatName, deleteChat } from "@/features/chat/actions";
import { useDomain } from "@/hooks/useDomain";
import { cn, isServiceError, unwrapServiceError } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { CirclePlusIcon, EllipsisIcon, PencilIcon, TrashIcon } from "lucide-react";
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
import Link from "next/link";
import { useSession } from "next-auth/react";

interface ChatSidePanelProps {
    order: number;
}

export const ChatSidePanel = ({
    order,
}: ChatSidePanelProps) => {
    const domain = useDomain();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const sidePanelRef = useRef<ImperativePanelHandle>(null);
    const router = useRouter();
    const { toast } = useToast();
    const chatId = useChatId();
    const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
    const [chatIdToRename, setChatIdToRename] = useState<string | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [chatIdToDelete, setChatIdToDelete] = useState<string | null>(null);
    const { status: authStatus } = useSession();

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

    const { data: recentChats, isPending, isError, refetch: refetchRecentChats } = useQuery({
        queryKey: ['chat', 'recents', domain],
        queryFn: () => unwrapServiceError(getRecentChats(domain)),
        enabled: authStatus === 'authenticated',
    });

    const onRenameChat = useCallback(async (name: string, chatId: string) => {
        if (!chatId) {
            return;
        }

        const response = await updateChatName({
            chatId,
            name: name,
        }, domain);

        if (isServiceError(response)) {
            toast({
                description: `❌ Failed to rename chat. Reason: ${response.message}`
            });
        } else {
            toast({
                description: `✅ Chat renamed successfully`
            });
            refetchRecentChats();
        }
    }, [refetchRecentChats, toast, domain]);

    const onDeleteChat = useCallback(async (chatIdToDelete: string) => {
        if (!chatIdToDelete) {
            return;
        }

        const response = await deleteChat({ chatId: chatIdToDelete }, domain);

        if (isServiceError(response)) {
            toast({
                description: `❌ Failed to delete chat. Reason: ${response.message}`
            });
        } else {
            toast({
                description: `✅ Chat deleted successfully`
            });

            // If we just deleted the current chat, navigate to new chat
            if (chatIdToDelete === chatId) {
                router.push(`/${domain}/chat`);
            }

            refetchRecentChats();
        }
    }, [chatId, refetchRecentChats, router, toast, domain]);

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
                                router.push(`/${domain}/chat`);
                            }}
                        >
                            <CirclePlusIcon className="w-4 h-4 mr-1" />
                            New Chat
                        </Button>
                    </div>
                    <ScrollArea className="flex flex-col h-full px-2.5">
                        <p className="text-sm font-medium mb-4">Recent Chats</p>
                        <div className="flex flex-col gap-1">
                            {authStatus === 'loading' ? (
                                <ChatHistorySkeleton />
                            ) : authStatus === 'unauthenticated' ? (
                                <div className="flex flex-col">
                                    <p className="text-sm text-muted-foreground mb-4">
                                        <Link
                                            href={`/login?callbackUrl=${encodeURIComponent(`/${domain}/chat`)}`}
                                            className="text-sm text-link hover:underline cursor-pointer"
                                        >
                                            Sign in
                                        </Link> to access your chat history.
                                    </p>
                                </div>
                            ) : isPending ? (
                                <ChatHistorySkeleton />
                            ) : isError ? (
                                <p>Error loading recent chats</p>
                            ) : recentChats.length === 0 ? (
                                <div className="mx-auto w-full h-52 border border-dashed border-muted-foreground rounded-md flex items-center justify-center p-6">
                                    <p className="text-sm text-muted-foreground text-center">Recent chats will appear here.</p>
                                </div>
                            ) : recentChats.map((chat) => (
                                <div
                                    key={chat.id}
                                    className={cn("group flex flex-row items-center justify-between hover:bg-muted rounded-md px-2 py-1.5 cursor-pointer",
                                        chat.id === chatId && "bg-muted"
                                    )}
                                    onClick={() => {
                                        router.push(`/${domain}/chat/${chat.id}`);
                                    }}
                                >
                                    <span className="text-sm truncate">{chat.name ?? 'Untitled chat'}</span>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
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
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            align="start"
                                            className="z-20"
                                        >
                                            <DropdownMenuItem
                                                className="cursor-pointer"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setChatIdToRename(chat.id);
                                                    setIsRenameDialogOpen(true);
                                                }}
                                            >
                                                <PencilIcon className="w-4 h-4 mr-2" />
                                                Rename
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="cursor-pointer"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setChatIdToDelete(chat.id);
                                                    setIsDeleteDialogOpen(true);
                                                }}
                                            >
                                                <TrashIcon className="w-4 h-4 mr-2" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
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
                            <KeyboardShortcutHint shortcut="⌘ B" />
                            <Separator orientation="vertical" className="h-4" />
                            <span>Open side panel</span>
                        </TooltipContent>
                    </Tooltip>
                </div>
            )}
            <RenameChatDialog
                isOpen={isRenameDialogOpen}
                onOpenChange={setIsRenameDialogOpen}
                onRename={(name) => {
                    if (chatIdToRename) {
                        onRenameChat(name, chatIdToRename);
                    }
                }}
                currentName={recentChats?.find((chat) => chat.id === chatIdToRename)?.name ?? ""}
            />
            <DeleteChatDialog
                isOpen={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                onDelete={() => {
                    if (chatIdToDelete) {
                        onDeleteChat(chatIdToDelete);
                    }
                }}
            />
        </>
    )
}

const ChatHistorySkeleton = () => {
    return (
        <div className="flex flex-col gap-1">
            {Array.from({ length: 20 }).map((_, index) => (
                <Skeleton
                    key={index}
                    className={cn(
                        "h-7 rounded-md",
                        index % 6 === 0 ? "w-[70%]" :
                            index % 6 === 1 ? "w-[85%]" :
                                index % 6 === 2 ? "w-full" :
                                    index % 6 === 3 ? "w-[85%]" :
                                        index % 6 === 4 ? "w-[70%]" :
                                            "w-[85%]"
                    )}
                />
            ))}
        </div>
    )
}   