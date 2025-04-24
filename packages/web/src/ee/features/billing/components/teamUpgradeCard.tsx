'use client';

import { UpgradeCard } from "./upgradeCard";
import { useToast } from "@/components/hooks/use-toast";
import { useDomain } from "@/hooks/useDomain";
import { isServiceError } from "@/lib/utils";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { TEAM_FEATURES } from "@/lib/constants";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { createStripeCheckoutSession } from "../actions";

interface TeamUpgradeCardProps {
    buttonText: string;
}

export const TeamUpgradeCard = ({ buttonText }: TeamUpgradeCardProps) => {
    const domain = useDomain();
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const captureEvent = useCaptureEvent();

    const onClick = useCallback(() => {
        captureEvent('wa_team_upgrade_card_pressed', {});
        setIsLoading(true);
        createStripeCheckoutSession(domain)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `❌ Stripe checkout failed with error: ${response.message}`,
                        variant: "destructive",
                    });
                    captureEvent('wa_team_upgrade_checkout_fail', {
                        error: response.errorCode,
                    });
                } else {
                    router.push(response.url);
                    captureEvent('wa_team_upgrade_checkout_success', {});
                }
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [domain, router, toast, captureEvent]);

    return (
        <UpgradeCard
            isLoading={isLoading}
            title="Team"
            description="For professional developers and small teams."
            price="$10"
            priceDescription="per user / month"
            features={TEAM_FEATURES}
            buttonText={buttonText}
            onClick={onClick}
        />
    )
}