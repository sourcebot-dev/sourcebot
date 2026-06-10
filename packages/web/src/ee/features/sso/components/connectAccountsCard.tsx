'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingButton } from "@/components/ui/loading-button";
import { skipOptionalProvidersLink } from "@/ee/features/sso/actions";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LinkedAccountProviderCard } from "./linkedAccountProviderCard";
import { LinkedAccount } from "@/ee/features/sso/actions";

interface ConnectAccountsCardProps {
    linkedAccounts: LinkedAccount[]
    callbackUrl?: string;
}

export const ConnectAccountsCard = ({ linkedAccounts, callbackUrl }: ConnectAccountsCardProps) => {
    const router = useRouter();
    const [isSkipping, setIsSkipping] = useState(false);

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

    // Only show account_linking providers in this flow
    const accountLinkingProviders = linkedAccounts.filter(a => a.isAccountLinkingProvider);
    const canSkip = !accountLinkingProviders.some(a => a.required && !a.isLinked);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Connect Your Accounts</CardTitle>
                <CardDescription>
                    Link the following accounts to enable permission syncing and access all features.
                    <br />
                    You can manage your linked accounts later in <strong>Settings → Linked Accounts.</strong>
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {accountLinkingProviders
                        .sort((a, b) => (b.required ? 1 : 0) - (a.required ? 1 : 0))
                        .map(account => (
                            <LinkedAccountProviderCard
                                key={account.providerId}
                                linkedAccount={account}
                                callbackUrl={callbackUrl}
                            />
                        ))}
                </div>
                {canSkip && (
                    <LoadingButton
                        variant="outline"
                        className="w-full mt-5"
                        onClick={handleSkip}
                        loading={isSkipping}
                    >
                        Skip for now
                    </LoadingButton>
                )}
            </CardContent>
        </Card>
    );
};
