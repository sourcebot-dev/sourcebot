"use client"

import { UpsellPanel } from "@/features/billing/upsellDialog"

/**
 * Shown in place of the analytics dashboard when the deployment is not on a plan
 * that includes analytics. FSL (not ee/) so it can render for free-plan users as
 * the upsell surface, reusing the shared feature-breakdown panel (plan comparison
 * + trial/upgrade) without mounting any ee/ analytics feature code.
 */
export function AnalyticsEntitlementMessage() {
    return (
        <div className="flex items-center justify-center min-h-[60vh] py-12 px-4">
            <UpsellPanel
                source="analytics_settings"
                returnPath="/settings/analytics"
                title="Upgrade to view analytics"
                description="Get insights into your organization's usage patterns and activity across search and Ask Sourcebot."
                className="w-full max-w-2xl"
            />
        </div>
    )
}
