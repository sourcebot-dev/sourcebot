"use client"

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { setMemberApprovalRequired } from "@/actions"
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants"
import { isServiceError } from "@/lib/utils"
import { useToast } from "@/components/hooks/use-toast"
import { InviteLinkToggle } from "@/app/components/inviteLinkToggle"

interface MemberApprovalRequiredToggleProps {
    memberApprovalRequired: boolean
    inviteLinkEnabled: boolean
    inviteLinkId?: string
}

export function MemberApprovalRequiredToggle({ memberApprovalRequired, inviteLinkEnabled, inviteLinkId }: MemberApprovalRequiredToggleProps) {
    const [enabled, setEnabled] = useState(memberApprovalRequired)
    const [isLoading, setIsLoading] = useState(false)
    const { toast } = useToast()

    const handleToggle = async (checked: boolean) => {
        setIsLoading(true)
        try {
            const result = await setMemberApprovalRequired(SINGLE_TENANT_ORG_DOMAIN, checked)
            
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

    return (
        <div className="space-y-6">
            <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--card)]">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-[var(--foreground)] mb-2">
                            Require approval for new members
                        </h3>
                        <div className="max-w-2xl">
                            <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                                When enabled, new users will need approval from an organization owner before they can access your deployment.{" "}
                                <a
                                    href="https://docs.sourcebot.dev/docs/configuration/auth/inviting-members"
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
            
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                enabled 
                    ? 'max-h-96 opacity-100' 
                    : 'max-h-0 opacity-0 pointer-events-none'
            }`}>
                <InviteLinkToggle inviteLinkEnabled={inviteLinkEnabled} inviteLinkId={inviteLinkId} />
            </div>
        </div>
    )
} 