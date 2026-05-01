'use client';

import { ComponentPropsWithoutRef, forwardRef, useMemo } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface UserAvatarProps extends ComponentPropsWithoutRef<typeof Avatar> {
    email?: string | null;
    imageUrl?: string | null;
}

export const UserAvatar = forwardRef<HTMLSpanElement, UserAvatarProps>(
    ({ email, imageUrl, className, ...rest }, ref) => {
        const resolverUri = useMemo(() => {
            if (!email) {
                return undefined;
            }
            return `/api/avatar?email=${encodeURIComponent(email)}`;
        }, [email]);

        const src = imageUrl ?? resolverUri;

        return (
            <Avatar ref={ref} className={cn("bg-muted", className)} {...rest}>
                {/*
                  We render a raw <img> instead of Radix's <AvatarImage>. AvatarImage
                  delays painting until its internal `new Image().onload` fires —
                  which is async even when the URL is in HTTP cache — and that
                  one-frame gap manifests as a flicker every time a marker mounts
                  (e.g., on scroll). The browser paints cached <img> synchronously.
                */}
                {src && (
                    <img
                        src={src}
                        alt=""
                        className="aspect-square h-full w-full"
                    />
                )}
            </Avatar>
        );
    }
);

UserAvatar.displayName = 'UserAvatar';
