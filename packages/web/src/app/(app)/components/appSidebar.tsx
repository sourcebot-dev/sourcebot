"use client";

import { ChatActionsDropdown } from "@/app/(app)/chat/components/chatActionsDropdown";
import { DeleteChatDialog } from "@/app/(app)/chat/components/deleteChatDialog";
import { DuplicateChatDialog } from "@/app/(app)/chat/components/duplicateChatDialog";
import { RenameChatDialog } from "@/app/(app)/chat/components/renameChatDialog";
import { SourcebotLogo } from "@/app/components/sourcebotLogo";
import { useToast } from "@/components/hooks/use-toast";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { UserAvatar } from "@/components/userAvatar";
import { deleteChat, duplicateChat, updateChatName } from "@/features/chat/actions";
import { captureEvent } from "@/hooks/useCaptureEvent";
import { cn, isServiceError } from "@/lib/utils";
import { BookMarkedIcon, ChevronsUpDown, EllipsisIcon, LogOut, MessageCircleIcon, MessagesSquareIcon, SearchIcon, SettingsIcon } from "lucide-react";
import { Session } from "next-auth";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import posthog from "posthog-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppearanceDropdownMenuGroup } from "./appearanceDropdownMenuGroup";


const items = [
    { title: "Ask", href: "/chat", icon: MessageCircleIcon },
    { title: "Code Search", href: "/search", icon: SearchIcon },
    { title: "Chats", href: "/chats", icon: MessagesSquareIcon },
    { title: "Repositories", href: "/repos", icon: BookMarkedIcon },
    { title: "Settings", href: "/settings", icon: SettingsIcon },
];

export interface ChatHistoryItem {
    id: string;
    name: string | null;
    createdAt: Date;
}

interface AppSidebarProps {
    session: Session | null;
    chatHistory: ChatHistoryItem[];
}

export function AppSidebar({ session, chatHistory }: AppSidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { toast } = useToast();

    const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
    const [chatIdToRename, setChatIdToRename] = useState<string | null>(null);
    const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
    const [chatIdToDuplicate, setChatIdToDuplicate] = useState<string | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [chatIdToDelete, setChatIdToDelete] = useState<string | null>(null);
    const [isScrolled, setIsScrolled] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = contentRef.current;
        if (!el) {
            return;
        }
        const handleScroll = () => setIsScrolled(el.scrollTop > 0);
        el.addEventListener("scroll", handleScroll);
        return () => el.removeEventListener("scroll", handleScroll);
    }, []);

    const isActive = (href: string) => {
        if (href === "/search") {
            return pathname === "/" || pathname.startsWith("/search");
        }
        if (href === "/chat") {
            return pathname === "/chat";
        }
        return pathname.startsWith(href);
    };

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

    return (
        <Sidebar
            collapsible="icon"
            className="!border-r-0"
        >
            <SidebarHeader className={cn("pt-4 border-b transition-[border-color] duration-200", isScrolled ? "border-sidebar-border" : "border-transparent")}>
                <Link href="/">
                    <div className="group-data-[state=collapsed]:hidden">
                        <SourcebotLogo className="w-fit h-8" size="large" />
                    </div>
                    <div className="hidden group-data-[state=collapsed]:block">
                        <SourcebotLogo className="w-fit h-8" size="small" />
                    </div>
                </Link>
                <SidebarMenu>
                    {items.map((item) => (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild isActive={isActive(item.href)}>
                                <a href={item.href}>
                                    <item.icon />
                                    <span>{item.title}</span>
                                </a>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent ref={contentRef}>
                {chatHistory.length > 0 && (
                    <SidebarGroup className="group-data-[state=collapsed]:hidden">
                        <SidebarGroupLabel className="text-muted-foreground">Recent Chats</SidebarGroupLabel>
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
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
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
            </SidebarContent>
            <SidebarFooter>
                {session && (
                    <MeControlDropdownMenu session={session} />
                )}
            </SidebarFooter>
        </Sidebar>
    );
}


interface MeControlDropdownMenuProps {
    session: Session;
}

export const MeControlDropdownMenu = ({
    session,
}: MeControlDropdownMenuProps) => {
    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        >
                            <UserAvatar
                                email={session.user.email}
                                imageUrl={session.user.image}
                                className="h-8 w-8"
                            />
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-semibold">{session.user.name ?? "User"}</span>
                                {session.user.email && (
                                    <span className="truncate text-xs text-muted-foreground">{session.user.email}</span>
                                )}
                            </div>
                            <ChevronsUpDown className="ml-auto size-4" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64" side="top" align="start" sideOffset={4}>
                        <DropdownMenuGroup>
                            <div className="flex flex-row items-center gap-3 px-3 py-3">
                                <UserAvatar
                                    email={session.user.email}
                                    imageUrl={session.user.image}
                                    className="h-10 w-10 flex-shrink-0"
                                />
                                <div className="flex flex-col flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate">{session.user.name ?? "User"}</p>
                                    {session.user.email && (
                                        <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
                                    )}
                                </div>
                            </div>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <AppearanceDropdownMenuGroup />
                        <DropdownMenuItem asChild>
                            <a href={`/settings`}>
                                <SettingsIcon className="h-4 w-4 mr-2" />
                                <span>Settings</span>
                            </a>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem
                                onClick={() => {
                                    signOut({
                                        redirectTo: "/login",
                                    }).then(() => {
                                        posthog.reset();
                                    })
                                }}
                            >
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Log out</span>
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}
