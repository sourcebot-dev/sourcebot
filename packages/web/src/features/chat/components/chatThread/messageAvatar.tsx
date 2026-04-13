'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useThemeNormalized } from '@/hooks/useThemeNormalized';
import { useSession } from 'next-auth/react';
import { SBChatMessage } from '../../types';
import { UserAvatar } from '@/components/userAvatar';

interface MessageAvatarProps {
    role: SBChatMessage['role'];
    className?: string;
}

export const MessageAvatar = ({ role, className }: MessageAvatarProps) => {
    // @todo: this should be based on the user who initiated the conversation.
    const { data: session } = useSession();
    const { theme } = useThemeNormalized();

    if (role === "user") {
        return (
            <UserAvatar
                email={session?.user.email}
                imageUrl={session?.user.image}
                className={cn("h-7 w-7 rounded-full", className)}
            />
        );
    }

    return (
        <Avatar className={cn("h-7 w-7 rounded-full", className)}>
            <AvatarFallback className="text-xs">AI</AvatarFallback>
            <AvatarImage
                src={`/${theme === 'dark' ? 'sb_logo_dark_small' : 'sb_logo_light_small'}.png?height=32&width=32`}
            />
        </Avatar>
    )
}

