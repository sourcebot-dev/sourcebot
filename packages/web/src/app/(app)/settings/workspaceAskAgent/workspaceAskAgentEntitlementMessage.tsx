"use client"

import { UpsellPanel } from "@/features/billing/upsellDialog"

/**
 * Shown in place of the workspace Ask Sourcebot connector configuration UI when the
 * deployment is not on a plan that includes Ask Sourcebot. FSL (not ee/) so it
 * can render for free-plan users as the upsell surface, reusing the shared
 * feature-breakdown panel (plan comparison + trial/upgrade) without mounting any
 * ee/ connector code.
 */
export function WorkspaceAskAgentEntitlementMessage() {
    return (
        <div className="flex items-center justify-center min-h-[60vh] py-12 px-4">
            <UpsellPanel
                source="chat_connectors"
                returnPath="/settings/workspaceAskAgent"
                title="Upgrade to configure Ask Sourcebot connectors"
                description="Approve the external tools (like Linear, Notion, and Sentry) that your users can connect to Ask Sourcebot."
                className="w-full max-w-2xl"
                loadingVariant="spinner"
            />
        </div>
    )
}
