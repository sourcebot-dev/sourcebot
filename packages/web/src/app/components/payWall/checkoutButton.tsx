"use client"

import { Button } from "@/components/ui/button"
import { getSubscriptionCheckoutRedirect} from "@/actions"
import { isServiceError } from "@/lib/utils"


export function CheckoutButton({ orgId }: { orgId: number }) {
    const redirectToCheckout = async () => {
        const redirectUrl = await getSubscriptionCheckoutRedirect(orgId)
        
        if(isServiceError(redirectUrl)) {
            console.error("Failed to create checkout session")
            return
        }
        
        window.location.href = redirectUrl!;
    }

    return (
        <div>
            <Button className="w-full" onClick={redirectToCheckout}>Choose Pqweqwro</Button>
        </div>
    )
}