'use client';

import { createStripeCheckoutSession } from "@/actions";
import { useDomain } from "@/hooks/useDomain";
import { NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY } from "@/lib/environment.client";
import { isServiceError } from "@/lib/utils";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useNonEmptyQueryParam } from "@/hooks/useNonEmptyQueryParam";
import { useEffect } from "react";
import { useToast } from "@/components/hooks/use-toast";
import { ErrorCode } from "@/lib/errorCodes";

const stripePromise = loadStripe(NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export const Checkout = () => {
    const domain = useDomain();
    const { toast } = useToast();
    const errorCode = useNonEmptyQueryParam('errorCode');
    const errorMessage = useNonEmptyQueryParam('errorMessage');

    useEffect(() => {
        if (errorCode === ErrorCode.STRIPE_CHECKOUT_ERROR && errorMessage) {
            toast({
                description: `⚠️ Stripe checkout failed with error: ${errorMessage}`,
                variant: "destructive",
             });
        }
    }, [errorCode, errorMessage]);

    return (
        <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{
                fetchClientSecret: async () => {
                    const response = await createStripeCheckoutSession(domain);
                    if (isServiceError(response)) {
                        throw response;
                    }
                    return response.clientSecret;
                }
            }}
        >
            <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
    )
}