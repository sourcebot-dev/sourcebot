"use client";

import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { LoadingButton } from "@/components/ui/loading-button";
import { createCheckoutSession } from "@/ee/features/lighthouse/actions";
import { BillingInterval, PlanComparisonTable } from "@/ee/features/lighthouse/planComparisonTable";
import { OffersResponse } from "@/ee/features/lighthouse/types";
import { useOffers } from "@/ee/features/lighthouse/useOffers";
import { useRole } from "@/features/auth/useRole";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { UpsellSource } from "@/lib/posthogEvents";
import { cn, isServiceError } from "@/lib/utils";
import { OrgRole } from "@sourcebot/db";
import { ArrowUpCircle, ExternalLink, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckoutDisclosures } from "./checkoutDisclosures";

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
            <DialogContent className="max-w-2xl gap-6 focus:outline-none">
                {isPending || !offers ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <UpsellPanelContent offers={offers} source={source} returnPath={returnPath} variant="dialog" />
                )}
            </DialogContent>
        </Dialog>
    );
}

interface UpsellPanelProps {
    source: UpsellSource;
    returnPath?: string;
    className?: string;
}

export function UpsellPanel({ source, returnPath, className }: UpsellPanelProps) {
    const { data: offers, isPending, isError } = useOffers();

    if (isError) {
        return null;
    }

    if (isPending || !offers) {
        return (
            <div className={cn("flex items-center justify-center py-12", className)}>
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col gap-6", className)}>
            <UpsellPanelContent offers={offers} source={source} returnPath={returnPath} variant="inline" />
        </div>
    );
}

interface UpsellPanelContentProps {
    offers: OffersResponse;
    source: UpsellSource;
    returnPath?: string;
    variant: "dialog" | "inline";
}

function UpsellPanelContent({ offers, source, returnPath, variant }: UpsellPanelContentProps) {
    const [billingInterval, setBillingInterval] = useState<BillingInterval>("year");
    const [isCheckoutSessionCreating, setIsCheckoutSessionCreating] = useState(false);
    const { data: session } = useSession();
    const sessionEmail = session?.user?.email ?? "";
    const [currentEmail, setCurrentEmail] = useState<string>("");
    const { toast } = useToast();
    const role = useRole();
    const isOwner = role === OrgRole.OWNER;

    // Only treat the email as an override when the user has actually changed it
    // away from the canonical session email.
    const overrideEmail =
        (
            sessionEmail &&
            currentEmail &&
            currentEmail !== sessionEmail
        )
            ? currentEmail
            : undefined;

    const handlePrimaryAction = useCallback(() => {
        setIsCheckoutSessionCreating(true);
        createCheckoutSession({
            source,
            requestTrial: offers.trial.eligible,
            interval: billingInterval,
            returnPath,
            overrideEmail,
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
    }, [billingInterval, offers.trial.eligible, returnPath, toast, source, overrideEmail]);

    const { title, description, buttonText } = useMemo(() => {
        // Members can't upgrade the workspace themselves — show them the feature
        // table so they understand what's gated, but route them to the owner.
        if (!isOwner) {
            return {
                title: "Sourcebot Pro",
                description: "Ask your organization owner to upgrade to Sourcebot Pro.",
                buttonText: "Got it",
            }
        }
        // trial, no cc
        if (offers.trial.eligible && !offers.trial.creditCardRequired) {
            return {
                title: "Try Sourcebot Pro",
                description: `Get full access free for ${offers.trial.durationDays} days. No credit card required.`,
                buttonText: `Start ${offers.trial.durationDays}-day free trial`
            }
        }
        // trial, cc
        else if (offers.trial.eligible && offers.trial.creditCardRequired) {
            return {
                title: "Try Sourcebot Pro",
                description: `Get full access free for ${offers.trial.durationDays} days. Card required, cancel anytime.`,
                buttonText: `Start ${offers.trial.durationDays}-day free trial`
            }
        }
        // no trial
        else {
            return {
                title: "Your organization is on the free plan",
                description: "Upgrade to unlock more features.",
                buttonText: "Upgrade"
            }
        }
    }, [isOwner, offers.trial.creditCardRequired, offers.trial.durationDays, offers.trial.eligible]);

    return (
        <>
            <div className="flex flex-col gap-1 text-center sm:text-left">
                <ArrowUpCircle className="h-6 w-6 bg-blue-500 text-gray-100 rounded-full" />
                {variant === "dialog" ? (
                    <DialogTitle>{title}</DialogTitle>
                ) : (
                    <h3 className="text-lg font-semibold leading-none tracking-tight">{title}</h3>
                )}
                {variant === "dialog" ? (
                    <DialogDescription className="text-base">{description}</DialogDescription>
                ) : (
                    <p className="text-base text-muted-foreground">{description}</p>
                )}
            </div>

            <PlanComparisonTable
                offers={offers}
                billingInterval={billingInterval}
                onBillingIntervalChange={setBillingInterval}
            />

            <div className="flex flex-col-reverse items-center gap-2 sm:flex-row sm:justify-end sm:gap-4">
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
                ) : variant === "dialog" ? (
                    <DialogClose asChild>
                        <Button>{buttonText}</Button>
                    </DialogClose>
                ) : (
                    <Button>{buttonText}</Button>
                )}
            </div>

            {isOwner && (
                <CheckoutDisclosures
                    sessionEmail={sessionEmail}
                    onEmailChanged={setCurrentEmail}
                    showNoCreditCardRequired={offers.trial.eligible && !offers.trial.creditCardRequired}
                />
            )}
        </>
    );
}
