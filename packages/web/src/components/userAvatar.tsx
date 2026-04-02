'use client';

import { minidenticon } from 'minidenticons';
import { ComponentPropsWithoutRef, forwardRef, useMemo } from 'react';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface UserAvatarProps extends ComponentPropsWithoutRef<typeof Avatar> {
    email?: string | null;
    imageUrl?: string | null;
}

export const UserAvatar = forwardRef<HTMLSpanElement, UserAvatarProps>(
    ({ email, imageUrl, className, ...rest }, ref) => {
        const identiconUri = useMemo(() => {
            if (!email) {
                return undefined;
            }
            return 'data:image/svg+xml;utf8,' + encodeURIComponent(minidenticon(email, 50, 50));
        }, [email]);

        return (
            <Avatar ref={ref} className={cn("bg-muted", className)} {...rest}>
                <AvatarImage src={imageUrl ?? identiconUri} />
            </Avatar>
        );
    }
);

UserAvatar.displayName = 'UserAvatar';
