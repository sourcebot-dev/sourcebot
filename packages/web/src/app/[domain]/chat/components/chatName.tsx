'use client';

import { getChatInfo, updateChatName } from "@/features/chat/actions";
import { useChatId } from "../useChatId";
import { useQuery } from "@tanstack/react-query";
import { useDomain } from "@/hooks/useDomain";
import { isServiceError, unwrapServiceError } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { LockIcon } from "lucide-react";
import { RenameChatDialog } from "./renameChatDialog";
import { useCallback, useMemo, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/hooks/use-toast";
import { useSession } from "next-auth/react";
import { GlobeIcon } from "@radix-ui/react-icons";

export const ChatName = () => {
    const chatId = useChatId();
    const domain = useDomain();
    const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
    const { toast } = useToast();

    const { data: chatInfo, isPending, isError, refetch } = useQuery({
        queryKey: ['chat', 'info', chatId, domain],
        queryFn: () => unwrapServiceError(getChatInfo({ chatId: chatId! }, domain)),
        enabled: !!chatId,
    });

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
            refetch();
        }
    }, [chatId, domain]);

    const { status: authStatus } = useSession();

    const visibility = useMemo(() => {
        if (authStatus === 'loading') {
            return undefined;
        }

        return authStatus === 'authenticated' ? 'private' : 'public';
    }, [authStatus]);

    if (isPending || isError) {
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
                            {chatInfo.name ?? 'Untitled chat'}
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
                currentName={chatInfo.name ?? ""}
            />
        </>
    )
}