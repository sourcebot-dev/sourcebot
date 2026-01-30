"use client"

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { setUpgradeToastEnabled } from "@/actions"
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants"
import { isServiceError } from "@/lib/utils"
import { useToast } from "@/components/hooks/use-toast"

interface UpgradeToastToggleProps {
    upgradeToastEnabled: boolean
    onToggleChange?: (checked: boolean) => void
}

export function UpgradeToastToggle({ upgradeToastEnabled, onToggleChange }: UpgradeToastToggleProps) {
    const [enabled, setEnabled] = useState(upgradeToastEnabled)
    const [isLoading, setIsLoading] = useState(false)
    const { toast } = useToast()

    const handleToggle = async (checked: boolean) => {
        setIsLoading(true)
        try {
            const result = await setUpgradeToastEnabled(SINGLE_TENANT_ORG_DOMAIN, checked)

            if (isServiceError(result)) {
                toast({
                    title: "Error",
                    description: result.message || "Failed to update upgrade notification setting",
                    variant: "destructive",
                })
                return
            }

            setEnabled(checked)
            onToggleChange?.(checked)

            toast({
                title: "Success",
                description: checked
                    ? "Version upgrade notifications enabled"
                    : "Version upgrade notifications disabled",
            })
        } catch (error) {
            console.error("Error updating upgrade toast setting:", error)
            toast({
                title: "Error",
                description: "Failed to update upgrade notification setting",
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
                        Version upgrade notifications
                    </h3>
                    <div className="max-w-2xl">
                        <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                            When enabled, users will see a notification when a new version of Sourcebot is available on GitHub.
                            Otherwise, only the owner will be notified when a new version becomes available.
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