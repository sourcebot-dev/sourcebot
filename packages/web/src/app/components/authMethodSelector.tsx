'use client';

import { signIn } from "next-auth/react";
import { useCallback } from "react";
import { getAuthProviderInfo } from "@/lib/utils";
import { MagicLinkForm } from "@/app/login/components/magicLinkForm";
import { CredentialsForm } from "@/app/login/components/credentialsForm";
import { DividerSet } from "@/app/components/dividerSet";
import { ProviderButton } from "@/app/components/providerButton";
import { AuthSecurityNotice } from "@/app/components/authSecurityNotice";
import type { IdentityProviderMetadata } from "@/lib/identityProviders";

interface AuthMethodSelectorProps {
    providers: IdentityProviderMetadata[];
    callbackUrl?: string;
    context: "login" | "signup";
    onProviderClick?: (providerId: string) => void;
    securityNoticeClosable?: boolean;
}

export const AuthMethodSelector = ({
    providers,
    callbackUrl,
    context,
    onProviderClick,
    securityNoticeClosable = false
}: AuthMethodSelectorProps) => {
    const onSignInWithOauth = useCallback((provider: string) => {
        // Call the optional analytics callback first
        onProviderClick?.(provider);

        signIn(
            provider,
            {
                redirectTo: callbackUrl ?? "/",
            },
            // @see: https://github.com/nextauthjs/next-auth/issues/2066
            // @see: https://openid.net/specs/openid-connect-core-1_0.html#AuthRequest
            // @see: https://next-auth.js.org/getting-started/client#additional-parameters
            {
                prompt: 'consent',
            }
        );
    }, [callbackUrl, onProviderClick]);

    // Separate OAuth providers from special auth methods
    const oauthProviders = providers.filter(p => p.purpose === "sso" &&
        !["credentials", "nodemailer"].includes(p.id)
    );
    const hasCredentials = providers.some(p => p.purpose === "sso" && p.id === "credentials");
    const hasMagicLink = providers.some(p => p.purpose === "sso" && p.id === "nodemailer");

    return (
        <>
            <AuthSecurityNotice closable={securityNoticeClosable} />
            <DividerSet
                elements={[
                    ...(oauthProviders.length > 0 ? [
                        <div key="oauth-providers" className="w-full space-y-3">
                            {oauthProviders.map((provider) => {
                                const providerInfo = getAuthProviderInfo(provider.id);
                                return (
                                    <ProviderButton
                                        key={provider.id}
                                        name={providerInfo.displayName}
                                        logo={providerInfo.icon}
                                        onClick={() => {
                                            onSignInWithOauth(provider.id);
                                        }}
                                        context={context}
                                    />
                                );
                            })}
                        </div>
                    ] : []),
                    ...(hasMagicLink ? [
                        <MagicLinkForm key="magic-link" callbackUrl={callbackUrl} context={context} />
                    ] : []),
                    ...(hasCredentials ? [
                        <CredentialsForm key="credentials" callbackUrl={callbackUrl} context={context} />
                    ] : [])
                ]}
            />
        </>
    );
}; 