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
import { Skeleton } from "@/components/ui/skeleton";
import { createCheckoutSession } from "@/features/billing/actions";
import { useHasLicense } from "@/features/billing/hasLicenseProvider";
import { BillingInterval, PlanComparisonTable } from "@/features/billing/planComparisonTable";
import type { OffersResponse } from "@sourcebot/shared/client";
import { useOffers } from "@/features/billing/useOffers";
import { useRole } from "@/features/auth/useRole";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { UpsellSource } from "@/lib/posthogEvents";
import { cn, isServiceError } from "@/lib/utils";
import { OrgRole } from "@sourcebot/db";
import { AlertCircle, ArrowUpCircle, ExternalLink, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { CheckoutDisclosures } from "./checkoutDisclosures";
import { CodeSnippet } from "@/app/components/codeSnippet";

interface UpsellDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    source: UpsellSource;
    returnPath?: string;
}

export function UpsellDialog({ open, onOpenChange, source, returnPath }: UpsellDialogProps) {
    const { data: offers, isPending, isError, refetch } = useOffers();
    const captureEvent = useCaptureEvent();

    useEffect(() => {
        if (open) {
            captureEvent('wa_upsell_dialog_viewed', { source });
        }
    }, [open, source, captureEvent]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl gap-6 focus:outline-none">
                {isError ? (
                    // Keep the dialog open with a recoverable error state rather than
                    // closing it out from under the user — the built-in close button
                    // is still the dismiss affordance.
                    <UpsellLoadError variant="dialog" onRetry={() => { void refetch(); }} />
                ) : isPending ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <UpsellPanelContent offers={offers} source={source} returnPath={returnPath} variant="dialog" licenseState="free" />
                )}
            </DialogContent>
        </Dialog>
    );
}

interface UpsellLoadErrorProps {
    variant: "dialog" | "inline";
    onRetry: () => void;
    className?: string;
}

// Shared fallback for when the offers/pricing fetch fails. Offers a retry plus a
// link to the public pricing page — the latter is resilient to the very failure
// that triggered this state, since it doesn't depend on the offers endpoint.
function UpsellLoadError({ variant, onRetry, className }: UpsellLoadErrorProps) {
    const role = useRole();
    const isOwner = role === OrgRole.OWNER;
    const heading = "Something went wrong";
    const body = (
        <>
            We couldn&apos;t reach Sourcebot&apos;s deployments server.{" "}
            {/* Owners get an actionable hint (the most common cause on self-hosted
                deployments is outbound access to the lighthouse host being blocked);
                members can't act on this themselves, so route them to an admin. */}
            {isOwner ? (
                <>
                    Check that outbound access to{" "}
                    <CodeSnippet>deployments.sourcebot.dev</CodeSnippet>{" "}isn&apos;t blocked.{" "}
                    <a
                        href="https://docs.sourcebot.dev/docs/misc/service-ping"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-link hover:underline"
                    >
                        Learn more
                    </a>
                    .
                </>
            ) : (
                <>Contact your organization admin.</>
            )}
        </>
    );
    return (
        <div className={cn("flex flex-col gap-6", className)}>
            <div className="flex flex-col gap-2 text-center sm:text-left">
                <AlertCircle className="h-6 w-6 text-destructive" />
                {variant === "dialog" ? (
                    <DialogTitle>{heading}</DialogTitle>
                ) : (
                    <h3 className="text-lg font-semibold leading-none tracking-tight">{heading}</h3>
                )}
                {variant === "dialog" ? (
                    <DialogDescription className="text-sm">{body}</DialogDescription>
                ) : (
                    <p className="text-sm text-muted-foreground">{body}</p>
                )}
            </div>

            <div className="flex flex-col-reverse items-center gap-2 sm:flex-row sm:justify-end sm:gap-4">
                <Button variant="ghost" asChild>
                    <a
                        href="https://status.sourcebot.dev"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Status page
                        <ExternalLink className="h-3.5 w-3.5 ml-2" />
                    </a>
                </Button>
                <Button onClick={onRetry}>Try again</Button>
            </div>
        </div>
    );
}

// Whether the upsell is being shown to a workspace with no usable license at
// all ('free') or to one with an existing online license that's lapsed
// ('expired'). Drives the no-trial-eligible copy so an expired-license user
// doesn't see misleading "free plan" framing.
export type UpsellLicenseState = 'free' | 'expired';

interface UpsellPanelProps {
    source: UpsellSource;
    returnPath?: string;
    className?: string;
    licenseState?: UpsellLicenseState;
    // Optional context-specific heading + subheading (e.g. "Upgrade to view Ask
    // Sourcebot history"). Fall back to the billing-state-derived copy when omitted.
    title?: string;
    description?: ReactNode;
    // How to render the pending state. Use 'skeleton' (default) when the panel is
    // embedded in-flow alongside other content, so the reserved space avoids
    // layout shift. Use 'spinner' when the panel is the sole, centered element in
    // a large empty region (e.g. a full-area feature gate), where a shaped
    // skeleton reads as heavier than a simple spinner.
    loadingVariant?: 'skeleton' | 'spinner';
}

export function UpsellPanel({ source, returnPath, className, licenseState = 'free', title, description, loadingVariant = 'skeleton' }: UpsellPanelProps) {
    const { data: offers, isPending, isError, refetch } = useOffers();

    if (isError) {
        return <UpsellLoadError variant="inline" onRetry={() => { void refetch(); }} className={className} />;
    }

    if (isPending || !offers) {
        if (loadingVariant === 'spinner') {
            return (
                <div className={cn("flex items-center justify-center py-12", className)} aria-busy="true">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            );
        }
        return (
            <div className={cn("flex flex-col gap-6", className)} aria-busy="true">
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-5 w-72" />
                </div>
                <Skeleton className="h-64 w-full" />
                <div className="flex flex-col-reverse items-center gap-2 sm:flex-row sm:justify-end sm:gap-4">
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-32" />
                </div>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col gap-6", className)}>
            <UpsellPanelContent offers={offers} source={source} returnPath={returnPath} variant="inline" licenseState={licenseState} titleOverride={title} descriptionOverride={description} />
        </div>
    );
}

interface UpsellPanelContentProps {
    offers: OffersResponse;
    source: UpsellSource;
    returnPath?: string;
    variant: "dialog" | "inline";
    licenseState: UpsellLicenseState;
    titleOverride?: string;
    descriptionOverride?: ReactNode;
}

function UpsellPanelContent({ offers, source, returnPath, variant, licenseState, titleOverride, descriptionOverride }: UpsellPanelContentProps) {
    const [billingInterval, setBillingInterval] = useState<BillingInterval>("year");
    const [isCheckoutSessionCreating, setIsCheckoutSessionCreating] = useState(false);
    const { data: session } = useSession();
    const sessionEmail = session?.user?.email ?? "";
    const [currentEmail, setCurrentEmail] = useState<string>("");
    const { toast } = useToast();
    const role = useRole();
    const isOwner = role === OrgRole.OWNER;
    const hasExistingLicense = useHasLicense();

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
                    try {
                        const checkoutUrl = new URL(response.url);
                        const allowedHosts = new Set(["checkout.stripe.com", "billing.stripe.com"]);
                        if (checkoutUrl.protocol !== "https:" || !allowedHosts.has(checkoutUrl.hostname)) {
                            throw new Error("Untrusted checkout URL.");
                        }
                        window.location.assign(checkoutUrl.toString());
                    } catch {
                        toast({
                            description: "Failed to start checkout. Please try again.",
                            variant: "destructive",
                        });
                        setIsCheckoutSessionCreating(false);
                    }
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

    const { title: computedTitle, description: computedDescription, buttonText } = useMemo(() => {
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
            if (licenseState === 'expired') {
                return {
                    title: "Your license has expired",
                    description: "Upgrade to continue using paid features.",
                    buttonText: "Upgrade"
                }
            }
            return {
                title: "Your organization is on the free plan",
                description: "Upgrade to unlock more features.",
                buttonText: "Upgrade"
            }
        }
    }, [isOwner, offers.trial.creditCardRequired, offers.trial.durationDays, offers.trial.eligible, licenseState]);

    // Allow callers to override the heading/subheading with feature-specific
    // context while keeping the billing-state-derived button text.
    const title = titleOverride ?? computedTitle;
    const description = descriptionOverride ?? computedDescription;

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
                    isNoCreditCardRequiredMessageVisible={offers.trial.eligible && !offers.trial.creditCardRequired}
                    isEmailValidationMessageVisible={!hasExistingLicense}
                />
            )}
        </>
    );
}
