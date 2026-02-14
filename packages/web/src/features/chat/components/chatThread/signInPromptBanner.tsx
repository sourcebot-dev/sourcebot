'use client';

import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const DISMISSED_KEY = 'sb.chat-sign-in-prompt-dismissed';

interface SignInPromptBannerProps {
    isAuthenticated: boolean;
    isOwner: boolean;
    hasMessages: boolean;
    isStreaming: boolean;
}

export const SignInPromptBanner = ({
    isAuthenticated,
    isOwner,
    hasMessages,
    isStreaming,
}: SignInPromptBannerProps) => {
    const pathname = usePathname();
    const [isDismissed, setIsDismissed] = useState(true); // Start as true to avoid flash
    const [hasShownOnce, setHasShownOnce] = useState(false);

    // Check sessionStorage on mount
    useEffect(() => {
        const dismissed = sessionStorage.getItem(DISMISSED_KEY) === 'true';
        setIsDismissed(dismissed);
    }, []);

    // Show the banner after first response completes
    useEffect(() => {
        if (!isAuthenticated && isOwner && hasMessages && !isStreaming && !hasShownOnce) {
            setHasShownOnce(true);
        }
    }, [isAuthenticated, isOwner, hasMessages, isStreaming, hasShownOnce]);

    const handleDismiss = () => {
        setIsDismissed(true);
        sessionStorage.setItem(DISMISSED_KEY, 'true');
    };

    // Don't show if:
    // - User is authenticated
    // - User doesn't own this chat
    // - Banner was dismissed
    // - No messages yet (haven't had first interaction)
    // - Still streaming (wait for response to complete)
    // - Haven't triggered the "show" condition yet
    if (isAuthenticated || !isOwner || isDismissed || !hasMessages || isStreaming || !hasShownOnce) {
        return null;
    }

    return (
        <div className="flex flex-row items-center justify-between gap-3 p-3 mb-4 border rounded-md bg-muted/50 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <p className="text-sm text-muted-foreground">
                Sign in to save chat history.
            </p>
            <div className="flex flex-row items-center gap-2">
                <Button
                    variant="default"
                    size="sm"
                    asChild
                >
                    <Link href={`/login?callbackUrl=${encodeURIComponent(pathname)}`}>
                        Sign in
                    </Link>
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleDismiss}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};
