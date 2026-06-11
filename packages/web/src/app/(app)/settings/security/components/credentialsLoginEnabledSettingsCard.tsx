"use client"

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { setCredentialsLoginEnabled } from "@/app/(app)/settings/security/actions"
import { cn, isServiceError } from "@/lib/utils"
import { useToast } from "@/components/hooks/use-toast"
import { BasicSettingsCard } from "@/app/(app)/settings/components/settingsCard"
import { SettingNotice } from "./settingNotice"

interface CredentialsLoginEnabledSettingsCardProps {
    isCredentialsLoginEnabled: boolean
    isControlledByEnvVar: boolean
    hasAlternativeLoginMethod: boolean
}

export function CredentialsLoginEnabledSettingsCard({
    isCredentialsLoginEnabled,
    isControlledByEnvVar,
    hasAlternativeLoginMethod
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
                    description: result.message ?? "Failed to update email login setting",
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

    // The toggle can't be turned off when there's no other way to sign in, but it
    // should still be possible to turn it back on in that situation.
    const lockedOnForLoginMethod = enabled && !hasAlternativeLoginMethod;
    const isDisabled = isLoading || isControlledByEnvVar || lockedOnForLoginMethod;

    return (
        <BasicSettingsCard
            name="Email & password login"
            description="When enabled, users can sign in with an email and password."
            className={cn((isControlledByEnvVar || lockedOnForLoginMethod) && "opacity-60")}
            footer={
                <>
                    {isControlledByEnvVar && (
                        <SettingNotice>
                            This setting is controlled by the <code className="bg-secondary px-1 py-0.5 rounded text-xs font-mono">AUTH_CREDENTIALS_LOGIN_ENABLED</code> environment variable.
                        </SettingNotice>
                    )}
                    {!isControlledByEnvVar && lockedOnForLoginMethod && (
                        <SettingNotice>
                            Email login can&apos;t be disabled because no other login method is configured. Configure an identity provider (SSO) or magic-code email login first.
                        </SettingNotice>
                    )}
                </>
            }
        >
            <Switch
                checked={enabled}
                onCheckedChange={handleToggle}
                disabled={isDisabled}
            />
        </BasicSettingsCard>
    )
}
