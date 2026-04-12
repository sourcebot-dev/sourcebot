"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { SettingsCard } from "../components/settingsCard";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { activateLicense, deactivateLicense } from "@/ee/features/lighthouse/actions";
import { isServiceError } from "@/lib/utils";
import { useToast } from "@/components/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

interface ActivationCodeCardProps {
    isActivated: boolean;
}

export function ActivationCodeCard({ isActivated }: ActivationCodeCardProps) {
    const [activationCode, setActivationCode] = useState("");
    const [isActivating, setIsActivating] = useState(false);
    const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
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

    const handleDeactivate = useCallback(() => {
        deactivateLicense()
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `Failed to remove license: ${response.message}`,
                        variant: "destructive",
                    });
                } else {
                    toast({
                        description: "License removed successfully.",
                    });
                    router.refresh();
                }
            });
    }, [toast, router]);

    return (
        <>
            <SettingsCard>
                <div className="flex flex-col gap-2">
                    <p className="font-medium">Activation code</p>
                    <p className="text-sm text-muted-foreground">
                        Enter your activation code to enable your enterprise license.
                    </p>
                    <Separator className="my-2" />
                    <div>
                        {isActivated ? (
                            <div className="flex items-center gap-3">
                                <code className="text-sm bg-muted px-3 py-2 rounded-md font-mono flex-1">
                                    sb_act_••••
                                </code>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setIsRemoveDialogOpen(true)}
                                >
                                    Remove
                                </Button>
                            </div>
                        ) : (
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
                        )}
                    </div>
                </div>
            </SettingsCard>

            <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove activation code</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove this activation code? Your deployment will lose access to enterprise features.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handleDeactivate}
                        >
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
