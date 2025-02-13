"use client"

import { Button } from "@/components/ui/button"
import { getSubscriptionCheckoutRedirect } from "@/actions"
import { isServiceError } from "@/lib/utils"


export function CheckoutButton({ domain }: { domain: string }) {
    const redirectToCheckout = async () => {
        const redirectUrl = await getSubscriptionCheckoutRedirect(domain)

        if (isServiceError(redirectUrl)) {
            console.error("Failed to create checkout session")
            return
        }

        window.location.href = redirectUrl!;
    }

    return (
        <Button className="w-full" onClick={redirectToCheckout}>Renew Membership</Button>
    )
}