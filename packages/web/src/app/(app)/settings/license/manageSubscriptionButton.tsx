"use client";

import { useState, useCallback } from "react";
import { LoadingButton } from "@/components/ui/loading-button";
import { createPortalSession } from "@/ee/features/lighthouse/actions";
import { isServiceError } from "@/lib/utils";
import { useToast } from "@/components/hooks/use-toast";
import { useRouter } from "next/navigation";

export function ManageSubscriptionButton() {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const handleClick = useCallback(() => {
        setIsLoading(true);

        const returnUrl = `${window.location.origin}/settings/license`;

        createPortalSession(returnUrl)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `Failed to open subscription portal: ${response.message}`,
                        variant: "destructive",
                    });
                    setIsLoading(false);
                } else {
                    router.push(response.url);
                }
            });
    }, [router, toast]);

    return (
        <LoadingButton
            variant="outline"
            onClick={handleClick}
            loading={isLoading}
        >
            Manage subscription
        </LoadingButton>
    );
}
