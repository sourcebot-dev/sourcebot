'use client';

import { createOnboardingStripeCheckoutSession } from "@/actions";
import { SourcebotLogo } from "@/app/components/sourcebotLogo";
import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useDomain } from "@/hooks/useDomain";
import { useNonEmptyQueryParam } from "@/hooks/useNonEmptyQueryParam";
import { ErrorCode } from "@/lib/errorCodes";
import { isServiceError } from "@/lib/utils";
import { Check, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TEAM_FEATURES } from "@/lib/constants";

export const Checkout = () => {
    const domain = useDomain();
    const { toast } = useToast();
    const errorCode = useNonEmptyQueryParam('errorCode');
    const errorMessage = useNonEmptyQueryParam('errorMessage');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (errorCode === ErrorCode.STRIPE_CHECKOUT_ERROR && errorMessage) {
            toast({
                description: `⚠️ Stripe checkout failed with error: ${errorMessage}`,
                variant: "destructive",
            });
        }
    }, [errorCode, errorMessage, toast]);

    const onCheckout = useCallback(() => {
        setIsLoading(true);
        createOnboardingStripeCheckoutSession(domain)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `❌ Stripe checkout failed with error: ${response.message}`,
                        variant: "destructive",
                    })
                } else {
                    router.push(response.url);
                }
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [domain, router, toast]);

    return (
        <div className="flex flex-col items-center justify-center max-w-md my-auto">
            <SourcebotLogo
                className="h-16"
                size="large"
            />
            <h1 className="text-2xl font-semibold">Start your 7 day free trial</h1>
            <p className="text-muted-foreground mt-2">Cancel anytime. No credit card required.</p>
            <ul className="space-y-4 mb-6 mt-10">
                {TEAM_FEATURES.map((feature, index) => (
                    <li key={index} className="flex items-center">
                        <div className="mr-3 flex-shrink-0">
                            <Check className="h-5 w-5 text-sky-500" />
                        </div>
                        <p className="text-gray-600 dark:text-gray-300">{feature}</p>
                    </li>
                ))}
            </ul>
            <div className="w-full px-16 mt-8">
                <Button
                    className="w-full"
                    onClick={onCheckout}
                    disabled={isLoading}
                >
                    {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Start free trial
                </Button>
            </div>
        </div>
    )
}