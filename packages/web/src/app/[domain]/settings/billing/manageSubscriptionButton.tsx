"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { isServiceError } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { getCustomerPortalSessionLink } from "@/actions"
import { useDomain } from "@/hooks/useDomain";
import { OrgRole } from "@sourcebot/db";
import useCaptureEvent from "@/hooks/useCaptureEvent";
export function ManageSubscriptionButton({ currentUserRole }: { currentUserRole: OrgRole }) {
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()
    const domain = useDomain();
    const captureEvent = useCaptureEvent();
    const redirectToCustomerPortal = async () => {
        setIsLoading(true)
        try {
            const session = await getCustomerPortalSessionLink(domain)
            if (isServiceError(session)) {
                captureEvent('wa_manage_subscription_button_create_portal_session_fail', {
                    error: session.errorCode,
                })
            } else {
                router.push(session)
                captureEvent('wa_manage_subscription_button_create_portal_session_success', {})
            }
        } catch (_error) {
            captureEvent('wa_manage_subscription_button_create_portal_session_fail', {
                error: "Unknown error",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const isOwner = currentUserRole === OrgRole.OWNER
    return (
        <div className="flex w-full justify-end">
            <Button
                onClick={redirectToCustomerPortal}
                disabled={isLoading || !isOwner}
                title={!isOwner ? "Only the owner of the org can manage the subscription" : undefined}
            >
                {isLoading ? "Creating customer portal..." : "Manage Subscription"}
            </Button>
        </div>
    )
}