"use client"

import { UpsellPanel } from "@/features/billing/upsellDialog"

/**
 * Shown in place of the per-user Ask Agent connector UI when the deployment is
 * not on a plan that includes Ask Sourcebot. FSL (not ee/) so it can render for
 * free-plan users as the upsell surface, reusing the shared feature-breakdown
 * panel (plan comparison + trial/upgrade) without mounting any ee/ connector code.
 */
export function AccountAskAgentEntitlementMessage() {
    return (
        <div className="flex items-center justify-center min-h-[60vh] py-12 px-4">
            <UpsellPanel
                source="chat_connectors"
                returnPath="/settings/accountAskAgent"
                title="Upgrade to use Ask Agent connectors"
                description="Connect Ask Sourcebot to your team's tools (like Linear, Notion, and Sentry) so it can pull in context beyond your indexed code."
                className="w-full max-w-2xl"
            />
        </div>
    )
}
