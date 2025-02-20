'use client';

import { UpgradeCard } from "./upgradeCard";
import { createStripeCheckoutSession } from "@/actions";
import { useToast } from "@/components/hooks/use-toast";
import { useDomain } from "@/hooks/useDomain";
import { isServiceError } from "@/lib/utils";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { TEAM_FEATURES } from "@/lib/constants";

interface TeamUpgradeCardProps {
    buttonText: string;
}

export const TeamUpgradeCard = ({ buttonText }: TeamUpgradeCardProps) => {
    const domain = useDomain();
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const onClick = useCallback(() => {
        setIsLoading(true);
        createStripeCheckoutSession(domain)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `❌ Stripe checkout failed with error: ${response.message}`,
                        variant: "destructive",
                    });
                } else {
                    router.push(response.url);
                }
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [domain, router, toast]);

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