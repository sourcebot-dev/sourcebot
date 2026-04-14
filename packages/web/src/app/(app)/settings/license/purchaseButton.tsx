"use client";

import { useState, useCallback } from "react";
import { LoadingButton } from "@/components/ui/loading-button";
import { createCheckoutSession } from "@/ee/features/lighthouse/actions";
import { isServiceError } from "@/lib/utils";
import { useToast } from "@/components/hooks/use-toast";
import { useRouter } from "next/navigation";

export function PurchaseButton() {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const handleClick = useCallback(() => {
        setIsLoading(true);

        const successUrl = `${window.location.origin}/settings/license?checkout=success`;
        const cancelUrl = `${window.location.origin}/settings/license`;

        createCheckoutSession(successUrl, cancelUrl)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `Failed to start checkout: ${response.message}`,
                        variant: "destructive",
                    });
                    setIsLoading(false);
                } else {
                    router.push(response.url);
                }
            })
    }, [router, toast]);

    return (
        <LoadingButton
            variant="outline"
            onClick={handleClick}
            loading={isLoading}
        >
            Purchase a license
        </LoadingButton>
    );
}
