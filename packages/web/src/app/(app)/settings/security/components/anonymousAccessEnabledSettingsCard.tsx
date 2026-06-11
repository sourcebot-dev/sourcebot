"use client"

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { setAnonymousAccessStatus } from "@/app/(app)/settings/security/actions"
import { cn, isServiceError } from "@/lib/utils"
import { useToast } from "@/components/hooks/use-toast"
import { BasicSettingsCard } from "@/app/(app)/settings/components/settingsCard"
import { SettingNotice } from "./settingNotice"

interface AnonymousAccessEnabledSettingsCardProps {
    anonymousAccessAvailable: boolean;
    anonymousAccessEnabled: boolean
    isControlledByEnvVar: boolean
}

export function AnonymousAccessEnabledSettingsCard({ anonymousAccessAvailable, anonymousAccessEnabled, isControlledByEnvVar }: AnonymousAccessEnabledSettingsCardProps) {
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
                    description: result.message || "Failed to update anonymous access setting",
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
    const isDisabled = isLoading || !anonymousAccessAvailable || isControlledByEnvVar;
    const showPlanMessage = !anonymousAccessAvailable;
    const showForceEnableMessage = !showPlanMessage && isControlledByEnvVar;

    return (
        <BasicSettingsCard
            name="Enable anonymous access"
            description="When enabled, users can access your deployment without logging in."
            className={cn((!anonymousAccessAvailable || isControlledByEnvVar) && "opacity-60")}
            footer={
                <>
                    {showPlanMessage && (
                        <SettingNotice>
                            Your current plan doesn&apos;t allow for anonymous access. Please{" "}
                            <a
                                href="https://www.sourcebot.dev/contact"
                                target="_blank"
                                rel="noopener"
                                className="font-medium text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
                            >
                                reach out
                            </a>
                            {" "}for assistance.
                        </SettingNotice>
                    )}
                    {showForceEnableMessage && (
                        <SettingNotice>
                            <code className="bg-secondary px-1 py-0.5 rounded text-xs font-mono">FORCE_ENABLE_ANONYMOUS_ACCESS</code> is set, so this cannot be changed from the UI.
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