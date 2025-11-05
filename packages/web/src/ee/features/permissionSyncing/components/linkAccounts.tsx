'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { skipOptionalProvidersLink } from "@/ee/features/permissionSyncing/actions";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LinkedAccountProviderCard } from "./linkedAccountProviderCard";
import { LinkedAccountProviderState } from "@/ee/features/permissionSyncing/types";

interface LinkAccountsProps {
    linkedAccountProviderStates: LinkedAccountProviderState[]
    callbackUrl?: string;
}

export const LinkAccounts = ({ linkedAccountProviderStates, callbackUrl }: LinkAccountsProps) => {
    const router = useRouter();
    const [isSkipping, setIsSkipping] = useState(false);

    const handleSkip = async () => {
        setIsSkipping(true);
        try {
            await skipOptionalProvidersLink();
        } catch (error) {
            console.error("Failed to skip optional providers:", error);
        } finally {
            setIsSkipping(false);
            router.refresh()
        }
    };

    const canSkip = !linkedAccountProviderStates.some(state => state.required && !state.isLinked);
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
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    {linkedAccountProviderStates
                        .sort((a, b) => (b.required ? 1 : 0) - (a.required ? 1 : 0))
                        .map(state => (
                        <LinkedAccountProviderCard
                            key={state.id}
                            linkedAccountProviderState={state}
                            callbackUrl={callbackUrl}
                        />
                    ))}
                </div>
                {canSkip && (
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
