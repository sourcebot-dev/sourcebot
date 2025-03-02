"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { isServiceError } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { getCustomerPortalSessionLink } from "@/actions"
import { useDomain } from "@/hooks/useDomain";
import { OrgRole } from "@sourcebot/db";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { ExternalLink, Loader2 } from "lucide-react";

export function ManageSubscriptionButton({ currentUserRole }: { currentUserRole: OrgRole }) {
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()
    const domain = useDomain();
    const captureEvent = useCaptureEvent();

    const redirectToCustomerPortal = async () => {
        setIsLoading(true)
        const session = await getCustomerPortalSessionLink(domain);
        if (isServiceError(session)) {
            captureEvent('wa_manage_subscription_button_create_portal_session_fail', {
                error: session.errorCode,
            });
            setIsLoading(false);
        } else {
            captureEvent('wa_manage_subscription_button_create_portal_session_success', {})
            router.push(session)
            // @note: we don't want to set isLoading to false here since we want to show the loading
            // spinner until the page is redirected.
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
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Manage Subscription
                <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
        </div>
    )
}