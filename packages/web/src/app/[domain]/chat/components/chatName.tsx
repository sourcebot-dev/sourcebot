'use client';

import { useToast } from "@/components/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { updateChatName } from "@/features/chat/actions";
import { isServiceError } from "@/lib/utils";
import { GlobeIcon } from "@radix-ui/react-icons";
import { ChatVisibility } from "@sourcebot/db";
import { LockIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { RenameChatDialog } from "./renameChatDialog";

interface ChatNameProps {
    name: string | null;
    visibility: ChatVisibility;
    id: string;
    isReadonly: boolean;
}

export const ChatName = ({ name, visibility, id, isReadonly }: ChatNameProps) => {
    const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const onRenameChat = useCallback(async (name: string) => {

        const response = await updateChatName({
            chatId: id,
            name: name,
        });

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
    }, [id, toast, router]);

    return (
        <>
            <div className="flex flex-row gap-2 items-center">
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
                                    {visibility === ChatVisibility.PUBLIC ? (
                                        <GlobeIcon className="w-3 h-3 mr-1" />
                                    ) : (
                                        <LockIcon className="w-3 h-3 mr-1" />
                                    )}
                                    {visibility === ChatVisibility.PUBLIC ? (isReadonly ? 'Public (Read-only)' : 'Public') : 'Private'}
                                </Badge>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            {visibility === ChatVisibility.PUBLIC ? `Anyone with the link can view this chat${!isReadonly ? ' and ask follow-up questions' : ''}.` : 'Only you can view and edit this chat.'}
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