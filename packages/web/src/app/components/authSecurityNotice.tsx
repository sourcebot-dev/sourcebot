'use client';

import React, { useState, useEffect } from "react";
import { env } from "@sourcebot/shared/client";

interface AuthSecurityNoticeProps {
    closable?: boolean;
}

const AUTH_SECURITY_NOTICE_COOKIE = "auth-security-notice-dismissed";

const getSecurityNoticeDismissed = (): boolean => {
    if (typeof document === "undefined") return false;
    const cookies = document.cookie.split(';').map(cookie => cookie.trim());
    const targetCookie = cookies.find(cookie => cookie.startsWith(`${AUTH_SECURITY_NOTICE_COOKIE}=`));

    if (!targetCookie) return false;

    try {
        const cookieValue = targetCookie.substring(`${AUTH_SECURITY_NOTICE_COOKIE}=`.length);
        return JSON.parse(decodeURIComponent(cookieValue));
    } catch (error) {
        console.warn('Failed to parse security notice cookie:', error);
        return false;
    }
};

const setSecurityNoticeDismissed = (dismissed: boolean) => {
    if (typeof document === "undefined") return;
    try {
        const expires = new Date();
        expires.setFullYear(expires.getFullYear() + 1);
        const cookieValue = encodeURIComponent(JSON.stringify(dismissed));
        document.cookie = `${AUTH_SECURITY_NOTICE_COOKIE}=${cookieValue}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
    } catch (error) {
        console.warn('Failed to set security notice cookie:', error);
    }
};

export const AuthSecurityNotice = ({ closable = false }: AuthSecurityNoticeProps) => {
    const [isDismissed, setIsDismissed] = useState(false);
    const [hasMounted, setHasMounted] = useState(false);

    // Only check cookie after component mounts to avoid hydration error
    useEffect(() => {
        setHasMounted(true);
        if (closable) {
            setIsDismissed(getSecurityNoticeDismissed());
        }
    }, [closable]);

    const handleDismiss = () => {
        setIsDismissed(true);
        setSecurityNoticeDismissed(true);
    };

    // Don't render if dismissed when closable, or if closable but not yet mounted
    if (closable && (!hasMounted || isDismissed)) {
        return null;
    }

    return (
        <div className={`p-4 rounded-lg bg-[var(--highlight)]/10 border border-[var(--highlight)]/20 relative ${closable ? 'pr-10' : ''}`}>
            {closable && (
                <button
                    onClick={handleDismiss}
                    className="absolute top-3 right-3 p-1 text-[var(--highlight)] hover:text-[var(--highlight)]/80 transition-colors"
                    aria-label="Dismiss security notice"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}
            <p className="text-sm text-[var(--highlight)] leading-6 flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>
                    <strong>Security Notice:</strong> Authentication data is managed by your deployment and is encrypted at rest. Zero data leaves your deployment.{' '}
                    <a
                        href="https://docs.sourcebot.dev/docs/configuration/auth/faq"
                        target="_blank"
                        rel="noopener"
                        className="underline text-[var(--highlight)] hover:text-[var(--highlight)]/80 font-medium"
                    >
                        Learn more
                    </a>
                </span>
            </p>
        </div>
    );
}; 