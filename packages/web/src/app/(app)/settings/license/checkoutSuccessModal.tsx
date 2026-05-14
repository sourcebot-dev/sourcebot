"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
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
import { activateLicense } from "@/ee/features/lighthouse/actions";
import { isServiceError } from "@/lib/utils";

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

interface CheckoutSuccessModalProps {
    userEmail?: string | null;
}

export function CheckoutSuccessModal({ userEmail }: CheckoutSuccessModalProps) {
    const [open, setOpen] = useState(true);
    const [activationCode, setActivationCode] = useState("");
    const [isActivating, setIsActivating] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const dismiss = useCallback(() => {
        setOpen(false);
        router.replace("/settings/license");
    }, [router]);

    const handleOpenChange = useCallback((next: boolean) => {
        if (!next) {
            dismiss();
        }
    }, [dismiss]);

    const handleActivate = useCallback(() => {
        const code = activationCode.trim();
        if (!code) {
            return;
        }

        setIsActivating(true);
        activateLicense(code)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `Failed to activate license: ${response.message}`,
                        variant: "destructive",
                    });
                    return;
                }

                toast({
                    description: "✅ License activated successfully.",
                });
                rainConfetti();
                dismiss();
            })
            .finally(() => {
                setIsActivating(false);
            });
    }, [activationCode, toast, dismiss]);

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md gap-6">
                <DialogHeader className="items-center text-center sm:text-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
                        <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <DialogTitle>One more step</DialogTitle>
                    <DialogDescription>
                        Check your email for your activation code, then paste it below to activate your license.
                    </DialogDescription>
                </DialogHeader>
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
                                handleActivate();
                            }
                        }}
                        disabled={isActivating}
                        className="font-mono"
                    />
                    {userEmail && (
                        <p className="text-xs text-muted-foreground">
                            Sent to {userEmail}
                        </p>
                    )}
                </div>
                <LoadingButton
                    onClick={handleActivate}
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
            </DialogContent>
        </Dialog>
    );
}
