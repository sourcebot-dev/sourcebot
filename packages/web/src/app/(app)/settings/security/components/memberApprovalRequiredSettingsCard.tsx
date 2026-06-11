"use client"

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { setMemberApprovalRequired } from "@/app/(app)/settings/security/actions"
import { cn, isServiceError } from "@/lib/utils"
import { useToast } from "@/components/hooks/use-toast"
import { BasicSettingsCard } from "@/app/(app)/settings/components/settingsCard"
import { SettingNotice } from "./settingNotice"

interface MemberApprovalRequiredSettingsCardProps {
    memberApprovalRequired: boolean
    isControlledByEnvVar: boolean
}

export const MemberApprovalRequiredSettingsCard = ({
    memberApprovalRequired,
    isControlledByEnvVar
}: MemberApprovalRequiredSettingsCardProps) => {
    const [enabled, setEnabled] = useState(memberApprovalRequired)
    const [isLoading, setIsLoading] = useState(false)
    const { toast } = useToast()

    const handleToggle = async (checked: boolean) => {
        setIsLoading(true)
        try {
            const result = await setMemberApprovalRequired(checked)
            
            if (isServiceError(result)) {
                toast({
                    title: "Error",
                    description: "Failed to update member approval setting",
                    variant: "destructive",
                })
                return
            }

            setEnabled(checked)
        } catch (error) {
            console.error("Error updating member approval setting:", error)
            toast({
                title: "Error",
                description: "Failed to update member approval setting",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const isDisabled = isLoading || isControlledByEnvVar;

    return (
        <BasicSettingsCard
            name="Require approval for new members"
            description="When enabled, new users will need approval from an organization owner before they can access your deployment."
            className={cn(isControlledByEnvVar && "opacity-60")}
            footer={isControlledByEnvVar && (
                <SettingNotice>
                    This setting is controlled by the <code className="bg-secondary px-1 py-0.5 rounded text-xs font-mono">REQUIRE_APPROVAL_NEW_MEMBERS</code> environment variable.
                </SettingNotice>
            )}
        >
            <Switch
                checked={enabled}
                onCheckedChange={handleToggle}
                disabled={isDisabled}
            />
        </BasicSettingsCard>
    )
}