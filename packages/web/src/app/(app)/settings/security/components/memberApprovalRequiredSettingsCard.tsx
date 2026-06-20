"use client"

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { setMemberApprovalRequired } from "@/app/(app)/settings/security/actions"
import { isServiceError } from "@/lib/utils"
import { useToast } from "@/components/hooks/use-toast"
import { BasicSettingsCard } from "@/app/(app)/settings/components/settingsCard"

interface MemberApprovalRequiredSettingsCardProps {
    memberApprovalRequired: boolean
}

export const MemberApprovalRequiredSettingsCard = ({
    memberApprovalRequired,
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
                    description: result.message,
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

    return (
        <BasicSettingsCard
            name="Require approval for new members"
            description="When enabled, new users will need approval from an organization owner before they can access your deployment."
        >
            <Switch
                checked={enabled}
                onCheckedChange={handleToggle}
                disabled={isLoading}
            />
        </BasicSettingsCard>
    )
}