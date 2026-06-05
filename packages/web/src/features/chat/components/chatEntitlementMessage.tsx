"use client"

import { ReactNode } from "react"
import { UpsellPanel } from "@/features/billing/upsellDialog"
import { UpsellSource } from "@/lib/posthogEvents"

interface ChatEntitlementMessageProps {
    source?: UpsellSource;
    /** Context-specific heading (e.g. "Upgrade to view Ask Sourcebot history"). */
    title?: string;
    /** Context-specific subheading describing the value (avoid repeating "Upgrade"). */
    description?: ReactNode;
    returnPath?: string;
}

/**
 * Shown in place of the Ask experience when the deployment is not on a plan that
 * includes Ask Sourcebot. This is FSL (not ee/) so it can render for free-plan
 * users as the upsell surface, and it renders the shared feature-breakdown panel
 * (plan comparison + trial/upgrade) without mounting any ee/ feature code.
 */
export function ChatEntitlementMessage({
    source = "chat",
    title = "Upgrade to use Ask Sourcebot",
    description = "Ask questions about your codebase and get answers with cited sources.",
    returnPath = "/chat",
}: ChatEntitlementMessageProps) {
    return (
        <div className="flex items-center justify-center min-h-[60vh] py-12 px-4">
            <UpsellPanel
                source={source}
                returnPath={returnPath}
                title={title}
                description={description}
                className="w-full max-w-2xl"
                loadingVariant="spinner"
            />
        </div>
    )
}
