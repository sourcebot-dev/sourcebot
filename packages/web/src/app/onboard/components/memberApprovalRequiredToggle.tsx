"use client"

import { useState, useEffect } from "react"
import { Switch } from "@/components/ui/switch"
import { setMemberApprovalRequired, getMemberApprovalRequired } from "@/actions"
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants"
import { isServiceError } from "@/lib/utils"
import { useToast } from "@/components/hooks/use-toast"
import { InviteLinkToggle } from "@/app/components/inviteLinkToggle"

interface MemberApprovalRequiredToggleProps {}

export function MemberApprovalRequiredToggle({}: MemberApprovalRequiredToggleProps) {
    const [enabled, setEnabled] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isInitializing, setIsInitializing] = useState(true)
    const { toast } = useToast()

    // Fetch initial value on component mount
    useEffect(() => {
        const fetchInitialValue = async () => {
            try {
                const result = await getMemberApprovalRequired(SINGLE_TENANT_ORG_DOMAIN)
                
                if (isServiceError(result)) {
                    toast({
                        title: "Error",
                        description: "Failed to load member approval setting",
                        variant: "destructive",
                    })
                    return
                }

                setEnabled(result)
            } catch (error) {
                console.error("Error fetching member approval setting:", error)
                toast({
                    title: "Error",
                    description: "Failed to load member approval setting",
                    variant: "destructive",
                })
            } finally {
                setIsInitializing(false)
            }
        }

        fetchInitialValue()
    }, [])

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
            toast({
                title: "Settings updated",
                description: checked 
                    ? "Member approval is now required" 
                    : "Member approval is no longer required"
            })
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
            <div className="flex items-center justify-between p-4 rounded-lg border border-[var(--border)] bg-[var(--card)]">
                <div className="flex-1">
                    <h3 className="font-medium text-[var(--foreground)] mb-1">
                        Require approval for new members
                    </h3>
                    <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                        When enabled, new users will need approval from an organization owner before they can access your deployment.{" "}
                        <a
                            href="https://docs.sourcebot.dev/docs/configuration/auth/overview#approving-new-members"
                            target="_blank"
                            rel="noopener"
                            className="underline text-[var(--primary)]"
                        >
                            Learn More
                        </a>
                    </p>
                </div>
                <div className="ml-4">
                    {isInitializing ? (
                        <div className="flex items-center justify-center w-11 h-6">
                            <svg 
                                className="animate-spin h-4 w-4 text-[var(--muted-foreground)]" 
                                fill="none" 
                                viewBox="0 0 24 24"
                            >
                                <circle 
                                    className="opacity-25" 
                                    cx="12" 
                                    cy="12" 
                                    r="10" 
                                    stroke="currentColor" 
                                    strokeWidth="4"
                                />
                                <path 
                                    className="opacity-75" 
                                    fill="currentColor" 
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                            </svg>
                        </div>
                    ) : (
                        <Switch
                            checked={enabled}
                            onCheckedChange={handleToggle}
                            disabled={isLoading}
                        />
                    )}
                </div>
            </div>
            
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                enabled && !isInitializing 
                    ? 'max-h-96 opacity-100 transform translate-y-0' 
                    : 'max-h-0 opacity-0 transform -translate-y-2'
            }`}>
                <InviteLinkToggle />
            </div>
        </div>
    )
} 