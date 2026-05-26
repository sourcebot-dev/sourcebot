"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpCircle, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { isServiceError } from "@/lib/utils";
import { createCheckoutSession } from "@/ee/features/lighthouse/actions";
import { useToast } from "@/components/hooks/use-toast";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { OffersResponse } from "@/ee/features/lighthouse/types";
import { useOffers } from "@/ee/features/lighthouse/useOffers";
import { BillingInterval, PlanComparisonTable } from "@/ee/features/lighthouse/planComparisonTable";
import { useRole } from "@/features/auth/useRole";
import { OrgRole } from "@sourcebot/db";
import { UpsellSource } from "@/lib/posthogEvents";

interface UpsellDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    source: UpsellSource;
    returnPath?: string;
}

export function UpsellDialog({ open, onOpenChange, source, returnPath }: UpsellDialogProps) {
    const { data: offers, isPending, isError } = useOffers();
    const { toast } = useToast();
    const captureEvent = useCaptureEvent();

    useEffect(() => {
        if (open) {
            captureEvent('wa_upsell_dialog_viewed', { source });
        }
    }, [open, source, captureEvent]);

    // Surface pricing-fetch failures via a toast and dismiss the dialog. Without
    // closing it ourselves, the parent's `open` state would keep us mounted but
    // we'd have nothing to render — leaving the user stuck with an invisible
    // dialog they can't dismiss.
    useEffect(() => {
        if (open && isError) {
            toast({
                description: "Something went wrong loading pricing. Please try again.",
                variant: "destructive",
            });
            onOpenChange(false);
        }
    }, [open, isError, toast, onOpenChange]);

    if (isError) {
        return null;
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl gap-6">
                {isPending || !offers ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <UpsellDialogContent offers={offers} source={source} returnPath={returnPath} />
                )}
            </DialogContent>
        </Dialog>
    );
}

interface UpsellDialogContentProps {
    offers: OffersResponse;
    source: UpsellSource;
    returnPath?: string;
}

function UpsellDialogContent({ offers, source, returnPath }: UpsellDialogContentProps) {
    const [billingInterval, setBillingInterval] = useState<BillingInterval>("year");
    const [isCheckoutSessionCreating, setIsCheckoutSessionCreating] = useState(false);
    const { toast } = useToast();
    const role = useRole();
    const isOwner = role === OrgRole.OWNER;

    const handlePrimaryAction = useCallback(() => {
        setIsCheckoutSessionCreating(true);
        createCheckoutSession({
            source,
            requestTrial: offers.trial.eligible,
            interval: billingInterval,
            returnPath,
        })
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `Failed to start checkout: ${response.message}`,
                        variant: "destructive",
                    });
                    setIsCheckoutSessionCreating(false);
                } else {
                    window.location.assign(response.url);
                }
            })
            .catch(() => {
                toast({
                    description: "Failed to start checkout. Please try again.",
                    variant: "destructive",
                });
                setIsCheckoutSessionCreating(false);
            })
    }, [billingInterval, offers.trial.eligible, returnPath, toast, source]);

    const { title, description, buttonText } = useMemo(() => {
        // Members can't upgrade the workspace themselves — show them the feature
        // table so they understand what's gated, but route them to the owner.
        if (!isOwner) {
            return {
                title: "Enterprise feature",
                description: "Ask your workspace owner to upgrade to Enterprise.",
                buttonText: "Got it",
            }
        }
        // trial, no cc
        if (offers.trial.eligible && !offers.trial.creditCardRequired) {
            return {
                title: "Try Sourcebot Enterprise free",
                description: `Get full access free for ${offers.trial.durationDays} days. No credit card required.`,
                buttonText: "Start free trial"
            }
        }
        // trial, cc
        else if ( offers.trial.eligible && offers.trial.creditCardRequired) {
            return {
                title: "Try Sourcebot Enterprise free",
                description: `Get full access free for ${offers.trial.durationDays} days. Card required, cancel anytime.`,
                buttonText: "Start free trial"
            }
        }
        // no trial
        else {
            return {
                title: "Your workspace is on the free plan",
                description: "Upgrade to unlock more features.",
                buttonText: "Upgrade"
            }
        }
    }, [isOwner, offers.trial.creditCardRequired, offers.trial.durationDays, offers.trial.eligible]);

    return (
        <>
            <DialogHeader className="gap-1">
                <ArrowUpCircle className="h-6 w-6 bg-blue-500 text-gray-100 rounded-full" />
                <DialogTitle>
                    {title}
                </DialogTitle>
                <DialogDescription className="text-base">
                    {description}
                </DialogDescription>
            </DialogHeader>

            <PlanComparisonTable
                offers={offers}
                billingInterval={billingInterval}
                onBillingIntervalChange={setBillingInterval}
            />

            <DialogFooter className="items-center gap-2 sm:gap-4">
                <Button variant="ghost" asChild>
                    <a
                        href="https://www.sourcebot.dev/pricing"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        See all plans
                        <ExternalLink className="h-3.5 w-3.5 ml-2" />
                    </a>
                </Button>
                {isOwner ? (
                    <LoadingButton onClick={handlePrimaryAction} loading={isCheckoutSessionCreating}>
                        {buttonText}
                    </LoadingButton>
                ) : (
                    <DialogClose asChild>
                        <Button>{buttonText}</Button>
                    </DialogClose>
                )}
            </DialogFooter>
        </>
    );
}
