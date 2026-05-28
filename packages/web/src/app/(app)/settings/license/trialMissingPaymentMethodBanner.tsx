"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/hooks/use-toast";
import { createPortalSession } from "@/ee/features/lighthouse/actions";
import { isServiceError } from "@/lib/utils";

export function TrialMissingPaymentMethodBanner() {
    const [isOpeningPortal, setIsOpeningPortal] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const handleAddPaymentMethod = useCallback(() => {
        setIsOpeningPortal(true);
        createPortalSession().then((response) => {
            if (isServiceError(response)) {
                toast({
                    description: `Failed to open subscription portal: ${response.message}`,
                    variant: "destructive",
                });
                setIsOpeningPortal(false);
                return;
            }
            router.push(response.url);
        });
    }, [router, toast]);

    return (
        <div className="flex items-center justify-between gap-3 border-t bg-warning/10 px-4 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-warning" />
                <p className="text-sm">
                    <span className="font-medium">No payment method on file.</span>{" "}
                    <span className="text-muted-foreground">Your plan will be suspended when the trial ends. Add a payment method to keep access.</span>
                </p>
            </div>
            <Button
                size="sm"
                variant="outline"
                onClick={handleAddPaymentMethod}
                disabled={isOpeningPortal}
                className="flex-shrink-0"
            >
                Add payment method
            </Button>
        </div>
    );
}
