"use client"

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { setAnonymousAccessStatus } from "@/app/(app)/settings/security/actions"
import { isServiceError } from "@/lib/utils"
import { useToast } from "@/components/hooks/use-toast"
import { BasicSettingsCard } from "@/app/(app)/settings/components/settingsCard"

interface AnonymousAccessEnabledSettingsCardProps {
    anonymousAccessEnabled: boolean
}

export function AnonymousAccessEnabledSettingsCard({ anonymousAccessEnabled }: AnonymousAccessEnabledSettingsCardProps) {
    const [enabled, setEnabled] = useState(anonymousAccessEnabled)
    const [isLoading, setIsLoading] = useState(false)
    const { toast } = useToast()

    const handleToggle = async (checked: boolean) => {
        setIsLoading(true)
        try {
            const result = await setAnonymousAccessStatus(checked)
            
            if (isServiceError(result)) {
                toast({
                    title: "Error",
                    description: result.message,
                    variant: "destructive",
                })
                return
            }

            setEnabled(checked)
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
        <BasicSettingsCard
            name="Enable anonymous access"
            description="When enabled, users can access your deployment without logging in."
        >
            <Switch
                checked={enabled}
                onCheckedChange={handleToggle}
                disabled={isLoading}
            />
        </BasicSettingsCard>
    )
}