'use client';

import { signIn } from "next-auth/react";
import { getAuthProviderInfo } from "@/lib/utils";
import type { IdentityProviderMetadata } from "@/lib/identityProviders";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { skipOptionalProvidersLink } from "./actions";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ProviderIcon } from "./components/providerIcon";
import { ProviderInfo } from "./components/providerInfo";

interface LinkAccountsProps {
    unlinkedAccounts: IdentityProviderMetadata[];
    callbackUrl?: string;
}

export const LinkAccounts = ({ unlinkedAccounts, callbackUrl }: LinkAccountsProps) => {
    const router = useRouter();
    const [isSkipping, setIsSkipping] = useState(false);

    const handleSignIn = (providerId: string) => {
        signIn(providerId, {
            redirectTo: callbackUrl ?? "/"
        });
    };

    const handleSkip = async () => {
        setIsSkipping(true);
        try {
            await skipOptionalProvidersLink();
            router.refresh();
        } catch (error) {
            console.error("Failed to skip optional providers:", error);
            setIsSkipping(false);
        }
    };

    // Separate required and optional providers
    const requiredProviders = unlinkedAccounts.filter(p => p.required !== false);
    const optionalProviders = unlinkedAccounts.filter(p => p.required === false);
    const hasOnlyOptionalProviders = requiredProviders.length === 0 && optionalProviders.length > 0;

    const renderProviderButton = (provider: IdentityProviderMetadata) => {
        const providerInfo = getAuthProviderInfo(provider.id);
        const isRequired = provider.required !== false;

        return (
            <button
                key={provider.id}
                onClick={() => handleSignIn(provider.id)}
                className="group w-full flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:bg-accent hover:border-accent-foreground/20 transition-all duration-200"
            >
                <div className="flex-shrink-0 group-hover:border-primary/20 transition-colors">
                    <ProviderIcon
                        icon={providerInfo.icon}
                        displayName={providerInfo.displayName}
                        size="md"
                    />
                </div>
                <div className="flex-1 min-w-0 text-left">
                    <ProviderInfo
                        providerId={provider.id}
                        required={isRequired}
                        showBadge={true}
                    />
                    <div className="text-xs text-muted-foreground mt-0.5">
                        Click to connect
                    </div>
                </div>
                <div className="flex-shrink-0">
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                </div>
            </button>
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Connect Your Accounts</CardTitle>
                <CardDescription>
                    {hasOnlyOptionalProviders ? (
                        <>
                            The following optional accounts can be linked to enhance your experience.
                            <br />
                            You can link them now or skip and manage them later in <strong>Settings → Linked Accounts.</strong>
                        </>
                    ) : (
                        <>
                            Link the following accounts to enable permission syncing and access all features.
                            <br />
                            You can manage your linked accounts later in <strong>Settings → Linked Accounts.</strong>
                        </>
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    {requiredProviders.map(renderProviderButton)}
                    {optionalProviders.map(renderProviderButton)}
                </div>
                {hasOnlyOptionalProviders && (
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleSkip}
                        disabled={isSkipping}
                    >
                        {isSkipping ? "Skipping..." : "Skip for now"}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
};
