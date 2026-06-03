"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";
import { SettingsCard } from "../components/settingsCard";
import { activateLicense } from "@/features/billing/actions";
import { isServiceError } from "@/lib/utils";
import { useToast } from "@/components/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

export function ActivationCodeCard() {
    const [activationCode, setActivationCode] = useState("");
    const [isActivating, setIsActivating] = useState(false);
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
                        description: "✅ License activated successfully.",
                    });
                    setActivationCode("");
                }
            })
            .finally(() => {
                setIsActivating(false);
            });
    }, [activationCode, toast]);

    return (
        <SettingsCard>
            <div className="flex flex-col gap-2">
                <p className="font-medium">Activation code</p>
                <p className="text-sm text-muted-foreground">
                    Enter your activation code to enable your Sourcebot license.
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
                </div>
            </div>
        </SettingsCard>
    );
}
