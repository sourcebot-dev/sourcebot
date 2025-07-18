"use client"

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { setAnonymousAccessStatus } from "@/actions"
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants"
import { isServiceError } from "@/lib/utils"
import { useToast } from "@/components/hooks/use-toast"

interface AnonymousAccessToggleProps {
    anonymousAccessEnabled: boolean
    onToggleChange?: (checked: boolean) => void
}

export function AnonymousAccessToggle({ anonymousAccessEnabled, onToggleChange }: AnonymousAccessToggleProps) {
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

    return (
        <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--card)]">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-[var(--foreground)] mb-2">
                        Enable anonymous access
                    </h3>
                    <div className="max-w-2xl">
                        <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                            When enabled, users can access your deployment without logging in.{" "}
                            <a
                                href="https://docs.sourcebot.dev/docs/configuration/auth/anonymous-access"
                                target="_blank"
                                rel="noopener"
                                className="underline text-[var(--primary)] hover:text-[var(--primary)]/80 transition-colors"
                            >
                                Learn More
                            </a>
                        </p>
                    </div>
                </div>
                <div className="flex-shrink-0">
                    <Switch
                        checked={enabled}
                        onCheckedChange={handleToggle}
                        disabled={isLoading}
                    />
                </div>
            </div>
        </div>
    )
}