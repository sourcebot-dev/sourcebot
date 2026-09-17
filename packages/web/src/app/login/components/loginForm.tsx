'use client';

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { SourcebotLogo } from "@/app/components/sourcebotLogo";
import { AuthMethodSelector } from "@/app/components/authMethodSelector";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { useIdentityProviders } from "@/features/auth/useIdentityProviders";
import Link from "next/link";
import { LoginMessage } from "@/features/auth/components/loginMessage";
import { getAuthErrorContent } from "@/features/auth/errorMessages";

interface LoginFormProps {
    callbackUrl?: string;
    error?: string;
    context: "login" | "signup";
    isAnonymousAccessEnabled?: boolean;
    hideSecurityNotice?: boolean;
    loginMessage?: string | null;
}

export const LoginForm = ({ callbackUrl, error, context, isAnonymousAccessEnabled = false, hideSecurityNotice = false, loginMessage }: LoginFormProps) => {
    const captureEvent = useCaptureEvent();
    const providers = useIdentityProviders();

    const safeCallbackUrl = useMemo(() => {
        if (!callbackUrl) return "/";
        // Allow only relative paths that start with "/" but not "//" (protocol-relative URLs)
        if (callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
            return callbackUrl;
        }
        return "/";
    }, [callbackUrl]);

    const errorMessage = getAuthErrorContent(error).description;

    // Helper function to get the correct analytics event name based on provider type.
    const getLoginEventName = (providerType: string) => {
        switch (providerType) {
            case "github":
                return "wa_login_with_github" as const;
            case "google":
                return "wa_login_with_google" as const;
            case "gitlab":
                return "wa_login_with_gitlab" as const;
            case "okta":
                return "wa_login_with_okta" as const;
            case "keycloak":
                return "wa_login_with_keycloak" as const;
            case "microsoft-entra-id":
                return "wa_login_with_microsoft_entra_id" as const;
            case "jumpcloud":
                return "wa_login_with_jumpcloud" as const;
            case "idira":
                return "wa_login_with_idira" as const;
            default:
                return "wa_login_with_github" as const; // fallback
        }
    };

    // Analytics callback for provider clicks
    const handleProviderClick = (providerId: string) => {
        const providerType = providers.find(p => p.id === providerId)?.type ?? providerId;
        captureEvent(getLoginEventName(providerType), {});
    };

    return (
        <div className="flex flex-col items-center justify-center w-full">
            <div className="mb-6 flex flex-col items-center">
                <SourcebotLogo
                    className="h-12 sm:h-16 mb-3"
                />
                <h2 className="text-lg font-medium text-center">
                    {context === "login" ? "Sign in to your account" : "Create a new account"}
                </h2>
            </div>
            <Card className="flex flex-col items-center border p-6 sm:p-8 rounded-lg gap-4 w-full sm:w-[500px] max-w-[500px] bg-background">
                <LoginMessage message={loginMessage} />
                <AuthMethodSelector
                    callbackUrl={callbackUrl}
                    context={context}
                    onProviderClick={handleProviderClick}
                    securityNoticeClosable={true}
                    hideSecurityNotice={hideSecurityNotice}
                />
                {error && (
                    <div role="alert" className="w-full rounded-md bg-red-50 dark:bg-red-950 p-3 text-left text-sm text-destructive text-wrap">
                        {errorMessage}
                    </div>
                )}
                <p className="text-sm text-muted-foreground mt-2">
                    {context === "login" ?
                        <>
                            Don&apos;t have an account? <Link className="underline" href={callbackUrl ? `/signup?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/signup"}>Sign up</Link>
                        </>
                    :
                        <>
                            Already have an account? <Link className="underline" href={callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login"}>Sign in</Link>
                        </>
                    }
                </p>
                {isAnonymousAccessEnabled && (
                    <p className="text-sm text-muted-foreground">
                        <Link className="underline" href={safeCallbackUrl}>Continue as guest</Link>
                    </p>
                )}
            </Card>
        </div>
    )
}
