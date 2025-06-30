'use client';

import { KeyboardShortcutHint } from "@/app/components/keyboardShortcutHint";
import { Button } from "@/components/ui/button";
import { ResizablePanel } from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { ImperativePanelHandle } from "react-resizable-panels";
import { CirclePlusIcon } from "lucide-react";
import {
    GoSidebarCollapse as ExpandIcon,
} from "react-icons/go";
import { getRecentChats } from "@/features/chat/actions";
import { unwrapServiceError } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useDomain } from "@/hooks/useDomain";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useChatId } from "../useChatId";

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
    const chatId = useChatId();

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

    const { data: recentChats, isPending, isError } = useQuery({
        queryKey: ['recent-chats', domain],
        queryFn: () => unwrapServiceError(getRecentChats(domain)),
    });

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
                    {isPending ? (
                        <div className="flex flex-col h-full px-2.5">
                            <Skeleton className="h-10" />
                        </div>
                    ) :
                    isError ? (
                        <div className="flex flex-col h-full px-2.5">
                            <p>Error loading recent chats</p>
                        </div>
                    ) : (
                        <ScrollArea className="flex flex-col h-full px-2.5">
                            <p className="text-sm font-medium mb-2">Recent Chats</p>
                            {recentChats.map((chat) => (
                                <div
                                    key={chat.id}
                                    className={cn("flex flex-row items-center justify-between hover:bg-muted rounded-md px-2 py-1.5 cursor-pointer",
                                        chat.id === chatId && "bg-muted"
                                    )}
                                    onClick={() => {
                                        router.push(`/${domain}/chat/${chat.id}`);
                                    }}
                                >
                                    <span className="text-sm truncate">{chat.name ?? 'Untitled chat'}</span>
                                </div>
                            ))}
                        </ScrollArea>
                    )}
                </div>
            </ResizablePanel>
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
        </>
    )
}