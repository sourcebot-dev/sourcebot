"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/ui/loading-button";
import { completeOnboarding } from "@/actions";
import { useToast } from "@/components/hooks/use-toast";
import { isServiceError } from "@/lib/utils";

export function AlreadyLicensedStep() {
    const router = useRouter();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const handleContinue = useCallback(async () => {
        setIsLoading(true);
        const result = await completeOnboarding();
        if (isServiceError(result)) {
            toast({
                description: `Failed to complete onboarding: ${result.message}`,
                variant: "destructive",
            });
            setIsLoading(false);
            return;
        }
        router.push("/");
    }, [router, toast]);

    return (
        <div className="space-y-4">
            <LoadingButton
                onClick={handleContinue}
                loading={isLoading}
                className="w-full"
            >
                Continue to Sourcebot
            </LoadingButton>
        </div>
    );
}
