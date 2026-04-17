"use client";

import { useState, useCallback } from "react";
import { LoadingButton } from "@/components/ui/loading-button";
import { refreshLicense } from "@/ee/features/lighthouse/actions";
import { isServiceError } from "@/lib/utils";
import { useToast } from "@/components/hooks/use-toast";
import { useRouter } from "next/navigation";

export function RefreshLicenseButton() {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const handleClick = useCallback(() => {
        setIsLoading(true);

        refreshLicense()
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `Failed to refresh license: ${response.message}`,
                        variant: "destructive",
                    });
                } else {
                    toast({
                        description: "License refreshed successfully.",
                    });
                    router.refresh();
                }
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [router, toast]);

    return (
        <LoadingButton
            variant="outline"
            onClick={handleClick}
            loading={isLoading}
        >
            Refresh license
        </LoadingButton>
    );
}
