'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useThemeNormalized } from '@/hooks/useThemeNormalized';
import { useSession } from 'next-auth/react';
import { SBChatMessage } from '../../types';

interface MessageAvatarProps {
    role: SBChatMessage['role'];
    className?: string;
}

export const MessageAvatar = ({ role, className }: MessageAvatarProps) => {
    const { data: session } = useSession();
    const { theme } = useThemeNormalized();

    return (
        <Avatar className={cn("h-7 w-7 rounded-full", className)}>
            <AvatarFallback className="text-xs">{role === "user" ? "U" : "AI"}</AvatarFallback>
            {role === "user" ? (
                <AvatarImage src={session?.user.image ?? "/placeholder_avatar.png?height=32&width=32"} />
            ) : (
                <AvatarImage
                    src={`/${theme === 'dark' ? 'sb_logo_dark_small' : 'sb_logo_light_small'}.png?height=32&width=32`}
                />
            )}
        </Avatar>
    )
}

