'use client';

import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { deleteChat, duplicateChat, updateChatName } from "@/features/chat/actions";
import { isServiceError } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ChatActionsDropdown } from "./chatActionsDropdown";
import { DeleteChatDialog } from "./deleteChatDialog";
import { DuplicateChatDialog } from "./duplicateChatDialog";
import { RenameChatDialog } from "./renameChatDialog";
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants";

interface ChatNameProps {
    name: string | null;
    id: string;
    isOwner?: boolean;
    isAuthenticated?: boolean;
}

export const ChatName = ({ name, id, isOwner = false, isAuthenticated = false }: ChatNameProps) => {
    const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
    const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const { toast } = useToast();
    const router = useRouter();
    const params = useParams<{ domain: string }>();

    const onRenameChat = useCallback(async (newName: string): Promise<boolean> => {
        const response = await updateChatName({
            chatId: id,
            name: newName,
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
            router.refresh();
            return true;
        }
    }, [id, toast, router]);

    const onDeleteChat = useCallback(async (): Promise<boolean> => {
        const response = await deleteChat({ chatId: id });

        if (isServiceError(response)) {
            toast({
                description: `❌ Failed to delete chat. Reason: ${response.message}`
            });
            return false;
        } else {
            toast({
                description: `✅ Chat deleted successfully`
            });
            router.push(`/${SINGLE_TENANT_ORG_DOMAIN}/chat`);
            router.refresh();
            return true;
        }
    }, [id, toast, router]);

    const onDuplicateChat = useCallback(async (newName: string): Promise<string | null> => {
        const response = await duplicateChat({ chatId: id, newName });

        if (isServiceError(response)) {
            toast({
                description: `❌ Failed to duplicate chat. Reason: ${response.message}`
            });
            return null;
        } else {
            toast({
                description: `✅ Chat duplicated successfully`
            });
            router.push(`/${params.domain}/chat/${response.id}`);
            return response.id;
        }
    }, [id, toast, router, params.domain]);

    return (
        <>
            <div className="flex flex-row gap-1 items-center">
                <p className="text-sm font-medium">
                    {name ?? 'Untitled chat'}
                </p>
                {isOwner && (
                    <ChatActionsDropdown
                        onRenameClick={() => setIsRenameDialogOpen(true)}
                        onDuplicateClick={() => setIsDuplicateDialogOpen(true)}
                        onDeleteClick={() => setIsDeleteDialogOpen(true)}
                        showDelete={isAuthenticated}
                        align="center"
                    >
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                        >
                            <ChevronDown className="h-4 w-4" />
                        </Button>
                    </ChatActionsDropdown>
                )}
            </div>
            <RenameChatDialog
                isOpen={isRenameDialogOpen}
                onOpenChange={setIsRenameDialogOpen}
                onRename={onRenameChat}
                currentName={name ?? "Untitled chat"}
            />
            <DeleteChatDialog
                isOpen={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                onDelete={onDeleteChat}
            />
            <DuplicateChatDialog
                isOpen={isDuplicateDialogOpen}
                onOpenChange={setIsDuplicateDialogOpen}
                onDuplicate={onDuplicateChat}
                currentName={name ?? "Untitled chat"}
            />
        </>
    )
}
