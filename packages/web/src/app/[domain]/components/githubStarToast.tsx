'use client';

import { useToast } from "@/components/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useEffect } from "react";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { captureEvent } from "@/hooks/useCaptureEvent";

const POPUP_SHOWN_COOKIE = "github_popup_shown";
const POPUP_START_TIME_COOKIE = "github_popup_start_time";
const POPUP_DELAY_S = 60;
const SOURCEBOT_GITHUB_URL = "https://github.com/sourcebot-dev/sourcebot";

function getCookie(name: string): string | null {
    if (typeof document === "undefined") return null;
    
    const cookies = document.cookie.split(';').map(cookie => cookie.trim());
    const targetCookie = cookies.find(cookie => cookie.startsWith(`${name}=`));
    
    if (!targetCookie) return null;
    
    return targetCookie.substring(`${name}=`.length);
}

function setCookie(name: string, value: string, days: number = 365) {
    if (typeof document === "undefined") return;
    
    try {
        const expires = new Date();
        expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${value}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
    } catch (error) {
        console.warn('Failed to set GitHub popup cookie:', error);
    }
}

export const GitHubStarToast = () => {
    const { toast } = useToast();

    useEffect(() => {
        const hasShownPopup = getCookie(POPUP_SHOWN_COOKIE);
        const startTime = getCookie(POPUP_START_TIME_COOKIE);
        
        if (hasShownPopup) {
            return;
        }
        
        const currentTime = Date.now();
        if (!startTime) {
            setCookie(POPUP_START_TIME_COOKIE, currentTime.toString());
            return;
        }
        
        const elapsed = currentTime - parseInt(startTime, 10);
        if (elapsed >= (POPUP_DELAY_S * 1000)) {
            toast({
                title: "Star us on GitHub ❤️",
                description: "If you've found Sourcebot useful, please consider starring us on GitHub. Your support means a lot!",
                duration: 15 * 1000,
                action: (
                    <div className="flex flex-col gap-1">
                        <ToastAction
                            altText="GitHub Button"
                            onClick={() => {
                                captureEvent('wa_github_star_toast_clicked', {});
                                window.open(SOURCEBOT_GITHUB_URL, "_blank");
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <GitHubLogoIcon className="w-4 h-4" />
                                Sourcebot
                            </div>
                        </ToastAction>
                    </div>
                )
            });
            
            captureEvent('wa_github_star_toast_displayed', {});
            setCookie(POPUP_SHOWN_COOKIE, "true");
        }
    }, [toast]);

    return null;
} 