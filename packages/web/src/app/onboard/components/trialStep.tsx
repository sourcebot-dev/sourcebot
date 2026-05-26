"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Skeleton } from "@/components/ui/skeleton";
import { completeOnboarding } from "@/actions";
import { createCheckoutSession } from "@/ee/features/lighthouse/actions";
import { useOffers } from "@/ee/features/lighthouse/useOffers";
import { BillingInterval, PlanComparisonTable } from "@/ee/features/lighthouse/planComparisonTable";
import { useToast } from "@/components/hooks/use-toast";
import { isServiceError } from "@/lib/utils";
import useCaptureEvent from "@/hooks/useCaptureEvent";

interface TrialStepCopy {
    title: string;
    subtitle: string;
}

function useTrialStepCopy(): TrialStepCopy | null {
    const { data: offers, isPending, isError } = useOffers();
    if (isPending) {
        return null;
    }
    if (isError || !offers) {
        return {
            title: "Upgrade to Sourcebot Enterprise",
            subtitle: "Unlock advanced features for your team. You can upgrade later from your license settings.",
        };
    }
    if (!offers.trial.eligible) {
        return {
            title: "Upgrade to Sourcebot Enterprise",
            subtitle: "Unlock advanced features for your team.",
        };
    }
    if (offers.trial.creditCardRequired) {
        return {
            title: "Try Sourcebot Enterprise free",
            subtitle: `Get full access free for ${offers.trial.durationDays} days. Card required, cancel anytime.`,
        };
    }
    return {
        title: "Try Sourcebot Enterprise free",
        subtitle: `Get full access free for ${offers.trial.durationDays} days. No credit card required.`,
    };
}

export function TrialStepTitle() {
    const copy = useTrialStepCopy();
    if (!copy) {
        return <Skeleton className="h-9 w-3/4" />;
    }
    return <>{copy.title}</>;
}

export function TrialStepSubtitle() {
    const copy = useTrialStepCopy();
    if (!copy) {
        return <Skeleton className="h-6 w-full" />;
    }
    return <>{copy.subtitle}</>;
}

interface TrialStepProps {
    memberCount: number;
}

export function TrialStep({ memberCount }: TrialStepProps) {
    const { data: offers, isPending, isError } = useOffers();
    const { toast } = useToast();
    const router = useRouter();
    const captureEvent = useCaptureEvent();
    const [billingInterval, setBillingInterval] = useState<BillingInterval>("year");
    const [isPrimaryLoading, setIsPrimaryLoading] = useState(false);
    const [isSkipLoading, setIsSkipLoading] = useState(false);

    // Fire-once when offers resolve, so isTrialEligible is reliable and react-query
    // refetches don't cause duplicate views.
    const hasCapturedViewRef = useRef(false);
    useEffect(() => {
        if (offers && !hasCapturedViewRef.current) {
            hasCapturedViewRef.current = true;
            captureEvent('wa_onboard_trial_step_viewed', {
                isTrialEligible: offers.trial.eligible,
            });
        }
    }, [offers, captureEvent]);

    const onSkipCheckout = useCallback(async () => {
        setIsSkipLoading(true);
        const result = await completeOnboarding();
        if (isServiceError(result)) {
            toast({
                description: `Failed to complete onboarding: ${result.message}`,
                variant: "destructive",
            });
            setIsSkipLoading(false);
            return;
        }
        router.push("/");
    }, [router, toast]);

    const onCheckout = useCallback(async (requestTrial: boolean) => {
        setIsPrimaryLoading(true);

        // Mark onboarding complete first so the post-checkout return lands inside
        // the (app) layout where CheckoutReturnHandler can fire. Otherwise the
        // layout's !isOnboarded guard would bounce them back to /onboard.
        const completeResult = await completeOnboarding();
        if (isServiceError(completeResult)) {
            toast({
                description: `Failed to complete onboarding: ${completeResult.message}`,
                variant: "destructive",
            });
            setIsPrimaryLoading(false);
            return;
        }

        const checkoutResult = await createCheckoutSession({
            source: "onboard",
            requestTrial,
            interval: billingInterval,
            returnPath: "/",
        });

        if (isServiceError(checkoutResult)) {
            toast({
                description: `Failed to start checkout: ${checkoutResult.message}`,
                variant: "destructive",
            });
            // Onboarding is already marked complete — send them to the app where
            // they can retry the upgrade from /settings/license.
            router.push("/");
            return;
        }

        window.location.assign(checkoutResult.url);
    }, [billingInterval, router, toast]);

    if (isPending) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-96 w-full" />
                <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </div>
        );
    }

    if (isError || !offers) {
        return (
            <LoadingButton
                onClick={onSkipCheckout}
                loading={isSkipLoading}
                className="w-full"
            >
                Continue to Sourcebot
            </LoadingButton>
        );
    }

    const isTrialEligible = offers.trial.eligible;
    const primaryButtonText = isTrialEligible
        ? `Start ${offers.trial.durationDays}-day trial`
        : "Purchase a license";

    return (
        <div className="space-y-6">
            <PlanComparisonTable
                offers={offers}
                billingInterval={billingInterval}
                onBillingIntervalChange={setBillingInterval}
            />

            <div className="space-y-2">
                <LoadingButton
                    onClick={() => onCheckout(isTrialEligible)}
                    loading={isPrimaryLoading}
                    disabled={isSkipLoading}
                    className="w-full"
                >
                    {primaryButtonText}
                </LoadingButton>
                <Button
                    variant="ghost"
                    onClick={() => {
                        captureEvent('wa_onboard_trial_step_skipped', { isTrialEligible });
                        onSkipCheckout();
                    }}
                    disabled={isPrimaryLoading || isSkipLoading}
                    className="w-full text-muted-foreground hover:text-foreground"
                >
                    {isSkipLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        "Skip for now"
                    )}
                </Button>
            </div>

            {memberCount > 1 && (
                <p className="text-xs text-muted-foreground text-center">
                    Trial includes your team of {memberCount} members.
                </p>
            )}
        </div>
    );
}
