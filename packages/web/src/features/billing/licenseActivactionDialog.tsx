"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import confetti from "canvas-confetti";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/ui/loading-button";
import { useToast } from "@/components/hooks/use-toast";
import { activateLicense, deactivateLicense } from "@/features/billing/actions";
import { useClaimActivationCode } from "@/features/billing/useClaimActivationCode";
import { isServiceError } from "@/lib/utils";
import { useHasLicense } from "./hasLicenseProvider";

const CONFETTI_COLORS = [
    "#ff3b3b", // red
    "#ffb800", // amber
    "#ffe600", // yellow
    "#3ecf8e", // green
    "#3b82f6", // blue
    "#a855f7", // purple
    "#ec4899", // pink
];

const rainConfetti = () => {
    const duration = 1500;
    const end = Date.now() + duration;
    const frame = () => {
        confetti({
            particleCount: 10,
            startVelocity: 20,
            ticks: 250,
            spread: 360,
            gravity: 2.5,
            colors: CONFETTI_COLORS,
            origin: { x: Math.random(), y: -0.1 },
        });
        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    };
    frame();
};

export function LicenseActivactionDialog() {
    const [open, setOpen] = useState(true);
    const [activationCode, setActivationCode] = useState("");
    const [isActivating, setIsActivating] = useState(false);
    const router = useRouter();
    const pathname = usePathname();
    const { toast } = useToast();
    const hasLicense = useHasLicense();

    const searchParams = useSearchParams();
    const sessionId = searchParams.get("session_id");

    const {
        status: claimStatus,
        activationCode: claimedCode,
        attempt: claimAttempt,
        start: startClaim,
    } = useClaimActivationCode();

    const dismiss = useCallback(() => {
        setOpen(false);
        // Strip the Stripe query params from whatever page we're currently on,
        // so a refresh doesn't re-trigger the claim flow.
        router.replace(pathname);
    }, [router, pathname]);

    const handleOpenChange = useCallback((next: boolean) => {
        if (!next) {
            dismiss();
        }
    }, [dismiss]);

    const activate = useCallback(async (code: string) => {
        setIsActivating(true);

        try {
            // Deactivate any existing license
            if (hasLicense) {
                const deactivateLicenseResponse = await deactivateLicense()
                if (isServiceError(deactivateLicenseResponse)) {
                    toast({
                        description: `Failed to deactive existing license: ${deactivateLicenseResponse.message}`,
                        variant: "destructive",
                    });
                }
            }

            const activateLicenseResponse = await activateLicense(code)
            if (isServiceError(activateLicenseResponse)) {
                toast({
                    description: `Failed to activate license: ${activateLicenseResponse.message}`,
                    variant: "destructive",
                });
                return;
            }

            toast({
                description: "✅ License activated successfully.",
            });
            rainConfetti();
            // Re-fetch the server-rendered layout so PlanContext picks up the
            // newly granted entitlements. Without this, callers like ChatBox
            // would keep reading the stale `isAskEnabled === false` and never
            // resume the pending submission stashed pre-checkout.
            router.refresh();
            dismiss();
        } finally {
            setIsActivating(false);
        }
    }, [hasLicense, toast, router, dismiss]);

    const handleManualActivate = useCallback(() => {
        const code = activationCode.trim();
        if (!code) {
            return;
        }
        activate(code);
    }, [activationCode, activate]);

    // Kick off auto-claim polling if Stripe redirected us with a session_id.
    useEffect(() => {
        if (sessionId) {
            startClaim(sessionId);
        }
    }, [sessionId, startClaim]);

    // When the claim succeeds, populate the input (so the user can see what was
    // claimed) and chain straight into activation.
    useEffect(() => {
        if (claimStatus === "success" && claimedCode) {
            setActivationCode(claimedCode);
            activate(claimedCode);
        }
    }, [claimStatus, claimedCode, activate]);

    const isPolling = claimStatus === "polling";

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                className="sm:max-w-md gap-6"
                hideCloseButton={isPolling}
                onEscapeKeyDown={(e) => {
                    if (isPolling) {
                        e.preventDefault();
                    }
                }}
                onInteractOutside={(e) => {
                    e.preventDefault();
                }}
            >
                <DialogHeader className="items-center text-center sm:text-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
                        <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <DialogTitle>
                        {isPolling ? "Activating your license" : "One more step"}
                    </DialogTitle>
                    <DialogDescription>
                        {isPolling
                            ? claimAttempt > 3
                                ? "Almost there. This is taking a little longer than usual."
                                : "Just a moment while we activate your license."
                            : "Check your email for your activation code, then paste it below to activate your license."}
                    </DialogDescription>
                </DialogHeader>

                {isPolling ? (
                    <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="activation-code" className="text-sm">
                                Activation code
                            </Label>
                            <Input
                                id="activation-code"
                                placeholder="sb_act_..."
                                value={activationCode}
                                onChange={(e) => setActivationCode(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleManualActivate();
                                    }
                                }}
                                disabled={isActivating}
                                className="font-mono"
                            />
                        </div>
                        <LoadingButton
                            onClick={handleManualActivate}
                            loading={isActivating}
                            disabled={!activationCode.trim()}
                            className="w-full"
                        >
                            Activate license
                        </LoadingButton>
                        <p className="text-xs text-muted-foreground text-center">
                            Didn&apos;t get it?{" "}
                            <a
                                href="mailto:support@sourcebot.dev"
                                className="text-primary hover:underline"
                            >
                                Email us
                            </a>
                        </p>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
