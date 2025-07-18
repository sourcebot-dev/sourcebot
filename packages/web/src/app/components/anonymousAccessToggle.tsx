"use client"

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { setAnonymousAccessStatus } from "@/actions"
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants"
import { isServiceError } from "@/lib/utils"
import { useToast } from "@/components/hooks/use-toast"

interface AnonymousAccessToggleProps {
    hasAnonymousAccessEntitlement: boolean;
    anonymousAccessEnabled: boolean
    forceEnableAnonymousAccess: boolean
    onToggleChange?: (checked: boolean) => void
}

export function AnonymousAccessToggle({ hasAnonymousAccessEntitlement, anonymousAccessEnabled, forceEnableAnonymousAccess, onToggleChange }: AnonymousAccessToggleProps) {
    const [enabled, setEnabled] = useState(anonymousAccessEnabled)
    const [isLoading, setIsLoading] = useState(false)
    const { toast } = useToast()

    const handleToggle = async (checked: boolean) => {
        setIsLoading(true)
        try {
            const result = await setAnonymousAccessStatus(SINGLE_TENANT_ORG_DOMAIN, checked)
            
            if (isServiceError(result)) {
                toast({
                    title: "Error",
                    description: result.message || "Failed to update anonymous access setting",
                    variant: "destructive",
                })
                return
            }

            setEnabled(checked)
            onToggleChange?.(checked)
        } catch (error) {
            console.error("Error updating anonymous access setting:", error)
            toast({
                title: "Error",
                description: "Failed to update anonymous access setting",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }
    const isDisabled = isLoading || !hasAnonymousAccessEntitlement || forceEnableAnonymousAccess;
    const showPlanMessage = !hasAnonymousAccessEntitlement;
    const showForceEnableMessage = !showPlanMessage && forceEnableAnonymousAccess;

    return (
        <div className={`p-4 rounded-lg border border-[var(--border)] bg-[var(--card)] ${(!hasAnonymousAccessEntitlement || forceEnableAnonymousAccess) ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-[var(--foreground)] mb-2">
                        Enable anonymous access
                    </h3>
                    <div className="max-w-2xl">
                        <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                            When enabled, users can access your deployment without logging in.
                        </p>
                        {showPlanMessage && (
                            <div className="mt-3 p-3 rounded-md bg-[var(--muted)] border border-[var(--border)]">
                                <p className="text-sm text-[var(--foreground)] leading-relaxed flex items-center gap-2">
                                    <svg 
                                        className="w-4 h-4 flex-shrink-0 text-[var(--muted-foreground)]" 
                                        fill="none" 
                                        viewBox="0 0 24 24" 
                                        stroke="currentColor"
                                    >
                                        <path 
                                            strokeLinecap="round" 
                                            strokeLinejoin="round" 
                                            strokeWidth={2} 
                                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                                        />
                                    </svg>
                                    <span>
                                        Your current plan doesn't allow for anonymous access. Please{" "}
                                        <a
                                            href="https://www.sourcebot.dev/contact"
                                            target="_blank"
                                            rel="noopener"
                                            className="font-medium text-[var(--primary)] hover:text-[var(--primary)]/80 underline underline-offset-2 transition-colors"
                                        >
                                            reach out
                                        </a>
                                        {" "}for assistance.
                                    </span>
                                </p>
                            </div>
                        )}
                        {showForceEnableMessage && (
                            <div className="mt-3 p-3 rounded-md bg-[var(--muted)] border border-[var(--border)]">
                                <p className="text-sm text-[var(--foreground)] leading-relaxed flex items-center gap-2">
                                    <svg 
                                        className="w-4 h-4 flex-shrink-0 text-[var(--muted-foreground)]" 
                                        fill="none" 
                                        viewBox="0 0 24 24" 
                                        stroke="currentColor"
                                    >
                                        <path 
                                            strokeLinecap="round" 
                                            strokeLinejoin="round" 
                                            strokeWidth={2} 
                                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                                        />
                                    </svg>
                                    <span>
                                        The <code className="bg-[var(--secondary)] px-1 py-0.5 rounded text-xs font-mono">forceEnableAnonymousAccess</code> is set, so this cannot be changed from the UI.
                                    </span>
                                </p>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex-shrink-0">
                    <Switch
                        checked={enabled}
                        onCheckedChange={handleToggle}
                        disabled={isDisabled}
                    />
                </div>
            </div>
        </div>
    )
}