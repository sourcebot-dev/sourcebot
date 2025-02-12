"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { isServiceError } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { getCustomerPortalSessionLink } from "@/actions"
import { useDomain } from "@/hooks/useDomain";

export function ManageSubscriptionButton() {
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()
    const domain = useDomain();

    const redirectToCustomerPortal = async () => {
        setIsLoading(true)
        try {
            const session = await getCustomerPortalSessionLink(domain)
            if (isServiceError(session)) {
                console.log("Failed to create portal session: ", session)
            } else {
                router.push(session)
            }
        } catch (error) {
            console.error("Error creating portal session:", error)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Button onClick={redirectToCustomerPortal} disabled={isLoading}>
          {isLoading ? "Creating customer portal..." : "Manage Subscription"}
        </Button>
      )
}