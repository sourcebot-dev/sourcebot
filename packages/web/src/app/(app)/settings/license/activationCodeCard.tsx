"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { SettingsCard } from "../components/settingsCard";
import { activateLicense, createCheckoutSession } from "@/ee/features/lighthouse/actions";
import { isServiceError } from "@/lib/utils";
import { useToast } from "@/components/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Loader2, ExternalLink } from "lucide-react";

interface ActivationCodeCardProps {
    isTrialEligible: boolean;
}

export function ActivationCodeCard({ isTrialEligible }: ActivationCodeCardProps) {
    const [activationCode, setActivationCode] = useState("");
    const [isActivating, setIsActivating] = useState(false);
    const [isCheckoutSessionCreating, setIsCheckoutSessionCreating] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const handleActivate = useCallback(() => {
        if (!activationCode.trim()) {
            return;
        }

        setIsActivating(true);
        activateLicense(activationCode.trim())
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `Failed to activate license: ${response.message}`,
                        variant: "destructive",
                    });
                } else {
                    toast({
                        description: "License activated successfully.",
                    });
                    setActivationCode("");
                    router.refresh();
                }
            })
            .finally(() => {
                setIsActivating(false);
            });
    }, [activationCode, toast, router]);

    const onCreateCheckoutSession = useCallback(() => {
        setIsCheckoutSessionCreating(true);

        createCheckoutSession(isTrialEligible)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `Failed to start checkout: ${response.message}`,
                        variant: "destructive",
                    });
                    setIsCheckoutSessionCreating(false);
                } else {
                    router.push(response.url);
                }
            });
    }, [router, toast, isTrialEligible]);

    return (
        <SettingsCard>
            <div className="flex flex-col gap-2">
                <p className="font-medium">Activation code</p>
                <p className="text-sm text-muted-foreground">
                    Enter your activation code to enable your enterprise license.
                </p>
                <Separator className="my-2" />
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                        <Input
                            placeholder="sb_act_..."
                            value={activationCode}
                            onChange={(e) => setActivationCode(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    handleActivate();
                                }
                            }}
                            disabled={isActivating}
                            className="font-mono"
                        />
                        <LoadingButton
                            size="sm"
                            onClick={handleActivate}
                            loading={isActivating}
                            disabled={!activationCode.trim()}
                        >
                            Activate
                        </LoadingButton>
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        Don&apos;t have an activation code?
                        <Button
                            variant="link"
                            className="h-auto p-0 gap-1"
                            onClick={onCreateCheckoutSession}
                            disabled={isCheckoutSessionCreating}
                        >
                            {isTrialEligible ? "Start a free trial" : "Purchase a license"}
                            {isCheckoutSessionCreating ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <ExternalLink className="h-3 w-3" />
                            )}
                        </Button>
                    </p>
                </div>
            </div>
        </SettingsCard>
    );
}
