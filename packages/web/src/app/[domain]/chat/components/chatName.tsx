'use client';

import { useToast } from "@/components/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { updateChatName } from "@/features/chat/actions";
import { useDomain } from "@/hooks/useDomain";
import { isServiceError } from "@/lib/utils";
import { GlobeIcon } from "@radix-ui/react-icons";
import { LockIcon } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useChatId } from "../useChatId";
import { RenameChatDialog } from "./renameChatDialog";

interface ChatNameProps {
    chatHistory: {
        id: string;
        createdAt: Date;
        name: string | null;
    }[];
}

export const ChatName = ({ chatHistory }: ChatNameProps) => {
    const chatId = useChatId();
    const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
    const { toast } = useToast();
    const domain = useDomain();
    const router = useRouter();

    const name = useMemo(() => {
        return chatHistory.find((chat) => chat.id === chatId)?.name ?? null;
    }, [chatHistory, chatId]);

    const onRenameChat = useCallback(async (name: string) => {
        if (!chatId) {
            return;
        }

        const response = await updateChatName({
            chatId: chatId,
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
            router.refresh();
        }
    }, [chatId, domain, toast]);

    const { status: authStatus } = useSession();

    const visibility = useMemo(() => {
        if (authStatus === 'loading') {
            return undefined;
        }

        return authStatus === 'authenticated' ? 'private' : 'public';
    }, [authStatus]);

    if (!chatId) {
        return null;
    }

    return (
        <>
            <div className="mx-auto flex flex-row gap-2 items-center">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <p
                            className="text-sm font-medium hover:underline cursor-pointer"
                            onClick={() => {
                                setIsRenameDialogOpen(true);
                            }}
                        >
                            {name ?? 'Untitled chat'}
                        </p>
                    </TooltipTrigger>
                    <TooltipContent>
                        Rename chat
                    </TooltipContent>
                </Tooltip>
                {visibility && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div>
                                <Badge variant="outline" className="cursor-default">
                                    {visibility === 'public' ? (
                                        <GlobeIcon className="w-3 h-3 mr-1" />
                                    ) : (
                                        <LockIcon className="w-3 h-3 mr-1" />
                                    )}
                                    {visibility === 'public' ? 'Public' : 'Private'}
                                </Badge>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            {visibility === 'public' ? 'Anyone with the link can view this chat' : 'Only you can view this chat'}
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>
            <RenameChatDialog
                isOpen={isRenameDialogOpen}
                onOpenChange={setIsRenameDialogOpen}
                onRename={onRenameChat}
                currentName={name ?? ""}
            />
        </>
    )
}