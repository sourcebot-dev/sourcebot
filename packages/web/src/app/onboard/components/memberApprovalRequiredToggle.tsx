"use client"

import { useState, useEffect } from "react"
import { Switch } from "@/components/ui/switch"
import { Loader2 } from "lucide-react"
import { setMemberApprovalRequired, getMemberApprovalRequired } from "@/actions"
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants"
import { isServiceError } from "@/lib/utils"
import { useToast } from "@/components/hooks/use-toast"
import { InviteLinkToggle } from "@/app/components/inviteLinkToggle"

export function MemberApprovalRequiredToggle() {
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
                                    href="https://docs.sourcebot.dev/docs/configuration/auth/overview#approving-new-members"
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
                        {isInitializing ? (
                            <div className="flex items-center justify-center w-11 h-6">
                                <Loader2 className="animate-spin h-4 w-4 text-[var(--muted-foreground)]" />
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