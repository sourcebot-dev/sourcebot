'use client';

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { SourcebotLogo } from "@/app/components/sourcebotLogo";
import { AuthMethodSelector } from "@/app/components/authMethodSelector";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import DemoCard from "@/app/login/components/demoCard";
import Link from "next/link";
import { env } from "@/env.mjs";
import type { AuthProvider } from "@/lib/authProviders";

const TERMS_OF_SERVICE_URL = "https://sourcebot.dev/terms";
const PRIVACY_POLICY_URL = "https://sourcebot.dev/privacy";

interface LoginFormProps {
    callbackUrl?: string;
    error?: string;
    providers: AuthProvider[];
    context: "login" | "signup";
}

export const LoginForm = ({ callbackUrl, error, providers, context }: LoginFormProps) => {
    const captureEvent = useCaptureEvent();

    const errorMessage = useMemo(() => {
        if (!error) {
            return "";
        }
        switch (error) {
            case "CredentialsSignin":
                return "Invalid email or password. Please try again.";
            case "OAuthAccountNotLinked":
                return "This email is already associated with a different sign-in method.";
            default:
                return "An error occurred during authentication. Please try again.";
        }
    }, [error]);

    // Helper function to get the correct analytics event name
    const getLoginEventName = (providerId: string) => {
        switch (providerId) {
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
            default:
                return "wa_login_with_github" as const; // fallback
        }
    };

    // Analytics callback for provider clicks
    const handleProviderClick = (providerId: string) => {
        captureEvent(getLoginEventName(providerId), {});
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
            {env.NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT !== undefined && (
                <div className="w-full sm:w-[500px] max-w-[500px]">
                    <DemoCard />
                </div>
            )}
            <Card className="flex flex-col items-center border p-6 sm:p-12 rounded-lg gap-4 sm:gap-6 w-full sm:w-[500px] max-w-[500px] bg-background">
                {error && (
                    <div className="text-sm text-destructive text-center text-wrap border p-2 rounded-md border-destructive">
                        {errorMessage}
                    </div>
                )}
                <AuthMethodSelector
                    providers={providers}
                    callbackUrl={callbackUrl}
                    context={context}
                    onProviderClick={handleProviderClick}
                    securityNoticeClosable={true}
                />
                <p className="text-sm text-muted-foreground mt-8">
                    {context === "login" ?
                        <>
                            Don&apos;t have an account? <Link className="underline" href="/signup">Sign up</Link>
                        </>
                    :
                        <>
                            Already have an account? <Link className="underline" href="/login">Sign in</Link>
                        </>
                    }
                </p>
            </Card>
            {env.NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT !== undefined && (
                <p className="text-xs text-muted-foreground mt-8">By signing in, you agree to the <Link className="underline" href={TERMS_OF_SERVICE_URL} target="_blank">Terms of Service</Link> and <Link className="underline" href={PRIVACY_POLICY_URL} target="_blank">Privacy Policy</Link>.</p>
            )}
        </div>
    )
}
