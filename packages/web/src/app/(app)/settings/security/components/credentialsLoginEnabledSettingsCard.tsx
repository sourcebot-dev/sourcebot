"use client"

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { setCredentialsLoginEnabled } from "@/app/(app)/settings/security/actions"
import { isServiceError } from "@/lib/utils"
import { useToast } from "@/components/hooks/use-toast"
import { BasicSettingsCard } from "@/app/(app)/settings/components/settingsCard"

interface CredentialsLoginEnabledSettingsCardProps {
    isCredentialsLoginEnabled: boolean
}

export function CredentialsLoginEnabledSettingsCard({
    isCredentialsLoginEnabled,
}: CredentialsLoginEnabledSettingsCardProps) {
    const [enabled, setEnabled] = useState(isCredentialsLoginEnabled)
    const [isLoading, setIsLoading] = useState(false)
    const { toast } = useToast()

    const handleToggle = async (checked: boolean) => {
        setIsLoading(true)
        try {
            const result = await setCredentialsLoginEnabled(checked)

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
            console.error("Error updating email login setting:", error)
            toast({
                title: "Error",
                description: "Failed to update email login setting",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <BasicSettingsCard
            name="Email & password login"
            description="When enabled, users can sign in with an email and password."
        >
            <Switch
                checked={enabled}
                onCheckedChange={handleToggle}
                disabled={isLoading}
            />
        </BasicSettingsCard>
    )
}
