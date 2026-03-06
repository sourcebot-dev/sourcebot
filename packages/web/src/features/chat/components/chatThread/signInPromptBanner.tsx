'use client';

import { Button } from '@/components/ui/button';
import { captureEvent } from '@/hooks/useCaptureEvent';
import { X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const DISMISSED_KEY = 'sb.chat-sign-in-prompt-dismissed';

interface SignInPromptBannerProps {
    chatId: string;
    isAuthenticated: boolean;
    isOwner: boolean;
    hasMessages: boolean;
    isStreaming: boolean;
}

export const SignInPromptBanner = ({
    chatId,
    isAuthenticated,
    isOwner,
    hasMessages,
    isStreaming,
}: SignInPromptBannerProps) => {
    const pathname = usePathname();
    const [isDismissed, setIsDismissed] = useState(true); // Start as true to avoid flash
    const [hasDisplayedEventFired, setHasDisplayedEventFired] = useState(false);

    // Check sessionStorage on mount
    useEffect(() => {
        const dismissed = sessionStorage.getItem(DISMISSED_KEY) === 'true';
        setIsDismissed(dismissed);
    }, []);

    const isBannerVisible =
        !isDismissed &&
        !isAuthenticated &&
        isOwner &&
        hasMessages &&
        !isStreaming;

    // Show the banner after first response completes and track display
    useEffect(() => {
        if (isBannerVisible && !hasDisplayedEventFired) {
            setHasDisplayedEventFired(true);
            captureEvent('wa_chat_sign_in_banner_displayed', { chatId });
        }
    }, [isBannerVisible, chatId, hasDisplayedEventFired]);


    const handleDismiss = () => {
        captureEvent('wa_chat_sign_in_banner_dismissed', { chatId });
        setIsDismissed(true);
        sessionStorage.setItem(DISMISSED_KEY, 'true');
    };

    const handleSignInClick = () => {
        captureEvent('wa_chat_sign_in_banner_clicked', { chatId });
    };

    if (!isBannerVisible) {
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
                    onClick={handleSignInClick}
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
