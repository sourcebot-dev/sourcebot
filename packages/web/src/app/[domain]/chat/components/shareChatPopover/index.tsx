'use client';

import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { ChatVisibility } from "@sourcebot/db";
import { ShareSettings } from "./shareSettings";
import { useCallback, useState } from "react";
import { shareChatWithUsers, unshareChatWithUser, updateChatVisibility } from "@/features/chat/actions";
import { useToast } from "@/components/hooks/use-toast";
import { isServiceError } from "@/lib/utils";
import { Link2Icon, LockIcon } from "lucide-react";
import { SessionUser } from "@/auth";
import { InvitePanel } from "./invitePanel";

interface ShareChatPopoverProps {
    chatId: string;
    visibility: ChatVisibility;
    currentUser?: SessionUser;
    sharedWithUsers: SessionUser[];
}

type View = 'main' | 'invite';

export const ShareChatPopover = ({
    chatId,
    visibility: _visibility,
    currentUser,
    sharedWithUsers: _sharedWithUsers
}: ShareChatPopoverProps) => {
    const [visibility, setVisibility] = useState(_visibility);
    const [sharedWithUsers, setSharedWithUsers] = useState(_sharedWithUsers);

    const [isOpen, _setIsOpen] = useState(false);
    const { toast } = useToast();
    const [view, setView] = useState<View>('main');

    const onChatVisibilityChange = useCallback(async (visibility: ChatVisibility) => {
        const response = await updateChatVisibility({ chatId, visibility });
        if (isServiceError(response)) {
            toast({
                description: `Failed to update visibility: ${response.message}`,
                variant: "destructive",
            });
            return false;
        } else {
            setVisibility(visibility);
            toast({
                description: "✅ Chat visibility updated"
            });
            return true;
        }
    }, [chatId, toast]);

    const onUnshareChatWithUser = useCallback(async (userId: string) => {
        const response = await unshareChatWithUser({ chatId, userId });
        if (isServiceError(response)) {
            toast({
                description: `Failed to remove invited user: ${response.message}`,
                variant: "destructive",
            });
            return false;
        } else {
            setSharedWithUsers(sharedWithUsers.filter(user => user.id !== userId));
            toast({
                description: "✅ Access removed"
            });
            return true;
        }
    }, [chatId, toast, sharedWithUsers]);


    const onShareChatWithUsers = useCallback(async (users: SessionUser[]) => {
        if (users.length === 0) {
            return false;
        }
        const response = await shareChatWithUsers({ chatId, userIds: users.map(user => user.id) });

        if (isServiceError(response)) {
            toast({
                description: `Failed to share with ${users.length} user${users.length > 1 ? 's' : ''}`,
                variant: "destructive",
            });
            return false;
        } else {
            setSharedWithUsers([...sharedWithUsers, ...users]);
            toast({
                description: `✅ Invited ${users.length} user${users.length > 1 ? 's' : ''}`
            });
            setView('main');
            return true;
        }
    }, [chatId, toast, sharedWithUsers]);

    const onOpenChange = useCallback((open: boolean) => {
        _setIsOpen(open);
        // Small delay to ensure the popover close animation completes
        setTimeout(() => {
            if (!open) {
                setView('main');
            }
        }, 100);
    }, []);


    return (
        <Popover open={isOpen} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8"
                >
                    {visibility === ChatVisibility.PUBLIC ? (
                        <Link2Icon className="h-4 w-4" />
                    ) : (
                        <LockIcon className="h-4 w-4" />
                    )}
                    Share
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[420px] p-0">
                {view === 'main' ? (
                    <ShareSettings
                        visibility={visibility}
                        onVisibilityChange={onChatVisibilityChange}
                        onRemoveSharedWithUser={onUnshareChatWithUser}
                        currentUser={currentUser}
                        sharedWithUsers={sharedWithUsers}
                        onOpenInviteView={() => setView('invite')}
                    />
                ) : (
                    <InvitePanel
                        chatId={chatId}
                        onBack={() => setView('main')}
                        onShareChatWithUsers={onShareChatWithUsers}
                    />
                )}
            </PopoverContent>
        </Popover>
    );
};
