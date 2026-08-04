"use client"

import { UpsellPanel } from "@/features/billing/upsellDialog"

/**
 * Shown in place of the Skills management UI when the deployment is not on a plan
 * that includes Ask Sourcebot. FSL (not ee/) so it can render for free-plan users
 * as the upsell surface without mounting any ee/ skill code.
 */
export function SkillsEntitlementMessage() {
    return (
        <div className="flex items-center justify-center min-h-[60vh] py-12 px-4">
            <UpsellPanel
                source="chat_connectors"
                returnPath="/settings/skills"
                title="Upgrade to use Ask Sourcebot skills"
                description="Create reusable slash-command workflows for Ask Sourcebot and share them with your workspace."
                className="w-full max-w-2xl"
                loadingVariant="spinner"
            />
        </div>
    )
}
