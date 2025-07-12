"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Copy, Check } from "lucide-react"
import { useToast } from "@/components/hooks/use-toast"
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants"
import { getOrgInviteId, getInviteLinkEnabled, setInviteLinkEnabled } from "@/actions"
import { isServiceError } from "@/lib/utils"

export function InviteLinkToggle() {
    const [enabled, setEnabled] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isInitializing, setIsInitializing] = useState(true)
    const [inviteLink, setInviteLink] = useState("")
    const [copied, setCopied] = useState(false)
    const { toast } = useToast()

    const fetchInviteLink = useCallback(async () => {
        const inviteId = await getOrgInviteId(SINGLE_TENANT_ORG_DOMAIN)
        if (!isServiceError(inviteId)) {
            setInviteLink(`${window.location.origin}/invite?id=${inviteId}`)
        }
    }, [])

    // Fetch initial value on component mount
    useEffect(() => {
        const fetchInitialValue = async () => {
            try {
                const result = await getInviteLinkEnabled(SINGLE_TENANT_ORG_DOMAIN)
                
                if (isServiceError(result)) {
                    toast({
                        title: "Error",
                        description: "Failed to load invite link setting",
                        variant: "destructive",
                    })
                    return
                }

                setEnabled(result)
                
                // If enabled, also fetch the invite link
                if (result) {
                    await fetchInviteLink()
                }
            } catch (error) {
                console.error("Error fetching invite link setting:", error)
                toast({
                    title: "Error",
                    description: "Failed to load invite link setting",
                    variant: "destructive",
                })
            } finally {
                setIsInitializing(false)
            }
        }

        fetchInitialValue()
    }, [toast, fetchInviteLink])

    const handleToggle = async (enabled: boolean) => {
        setIsLoading(true)
        try {
            const result = await setInviteLinkEnabled(SINGLE_TENANT_ORG_DOMAIN, enabled)
            
            if (isServiceError(result)) {
                toast({
                    title: "Error",
                    description: "Failed to update invite link setting",
                    variant: "destructive",
                })
                return
            }

            setEnabled(enabled)
            
            // If enabled, fetch the invite link; if disabled, clear it
            if (enabled) {
                await fetchInviteLink()
            } else {
                setInviteLink("")
            }
        } catch (error) {
            console.error("Error updating invite link setting:", error)
            toast({
                title: "Error",
                description: "Failed to update invite link setting",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(inviteLink)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error("Failed to copy text: ", err)
            toast({
                title: "Error",
                description: "❌ Failed to copy invite link to clipboard",
                variant: "destructive",
            })
        }
    }

    return (
        <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--card)]">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-[var(--foreground)] mb-2">
                        Enable invite link
                    </h3>
                    <div className="max-w-2xl">
                        <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                            When enabled, team members can use the invite link to join your organization without requiring approval.
                        </p>
                    </div>
                </div>
                <div className="flex-shrink-0">
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
                    ? 'max-h-96 opacity-100 transform translate-y-0 mt-4' 
                    : 'max-h-0 opacity-0 transform -translate-y-2'
            }`}>
                <div className="space-y-4 pt-4 border-t border-[var(--border)]">
                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <Input
                                value={inviteLink}
                                readOnly
                                className="flex-1 bg-[var(--muted)] border-[var(--border)] text-[var(--foreground)]"
                                placeholder="Loading invite link..."
                            />
                            <Button
                                onClick={handleCopy}
                                variant="outline"
                                size="icon"
                                className="shrink-0 border-[var(--border)] hover:bg-[var(--muted)]"
                                disabled={!inviteLink}
                            >
                                {copied ? (
                                    <Check className="h-4 w-4 text-[var(--chart-2)]" />
                                ) : (
                                    <Copy className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </div>
                    
                    <p className="text-sm text-[var(--muted-foreground)]">
                        You can find this link again in the <strong>Settings → Members</strong> page.
                    </p>
                </div>
            </div>
        </div>
    )
} 