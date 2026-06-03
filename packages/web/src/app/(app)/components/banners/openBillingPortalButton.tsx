'use client';

import { useCallback, useState } from "react";
import { ExternalLink } from "lucide-react";
import { LoadingButton } from "@/components/ui/loading-button";
import { useToast } from "@/components/hooks/use-toast";
import { createPortalSession } from "@/ee/features/lighthouse/actions";
import { isServiceError } from "@/lib/utils";

interface OpenBillingPortalButtonProps {
    label: string;
}

export function OpenBillingPortalButton({ label }: OpenBillingPortalButtonProps) {
    const [isOpeningPortal, setIsOpeningPortal] = useState(false);
    const { toast } = useToast();

    const handleClick = useCallback(() => {
        setIsOpeningPortal(true);
        createPortalSession()
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `Failed to open billing portal: ${response.message}`,
                        variant: "destructive",
                    });
                } else {
                    window.location.assign(response.url);
                }
            })
            .catch(() => {
                toast({
                    description: "Failed to open billing portal. Please try again.",
                    variant: "destructive",
                });
            })
            .finally(() => {
                setIsOpeningPortal(false);
            });
    }, [toast]);

    return (
        <LoadingButton
            size="sm"
            variant="outline"
            onClick={handleClick}
            loading={isOpeningPortal}
        >
            {label}
            <ExternalLink className="h-3.5 w-3.5" />
        </LoadingButton>
    );
}
