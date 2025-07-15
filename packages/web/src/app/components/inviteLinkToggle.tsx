"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Copy, Check } from "lucide-react"
import { useToast } from "@/components/hooks/use-toast"
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants"
import { getOrgInviteId, setInviteLinkEnabled } from "@/actions"
import { isServiceError } from "@/lib/utils"

interface InviteLinkToggleProps {
    inviteLinkEnabled: boolean
}

export function InviteLinkToggle({ inviteLinkEnabled }: InviteLinkToggleProps) {
    const [enabled, setEnabled] = useState(inviteLinkEnabled)
    const [isLoading, setIsLoading] = useState(false)
    const [inviteLink, setInviteLink] = useState("")
    const [copied, setCopied] = useState(false)
    const { toast } = useToast()

    // Fetch invite link when component mounts if enabled
    useEffect(() => {
        const fetchInviteLink = async () => {
            if (inviteLinkEnabled) {
                try {
                    const inviteIdResult = await getOrgInviteId(SINGLE_TENANT_ORG_DOMAIN)
                    if (!isServiceError(inviteIdResult)) {
                        setInviteLink(`${window.location.origin}/invite?id=${inviteIdResult}`)
                    }
                } catch (error) {
                    setInviteLink("")
                    console.error("Error fetching invite link:", error)
                }
            }
        }

        fetchInviteLink()
    }, [inviteLinkEnabled])

    const handleToggle = async (checked: boolean) => {
        setIsLoading(true)
        try {
            const result = await setInviteLinkEnabled(SINGLE_TENANT_ORG_DOMAIN, checked)
            
            if (isServiceError(result)) {
                toast({
                    title: "Error",
                    description: "Failed to update invite link setting",
                    variant: "destructive",
                })
                return
            }

            setEnabled(checked)
            
            // If enabled, fetch the invite link; if disabled, clear it
            if (checked) {
                const inviteIdResult = await getOrgInviteId(SINGLE_TENANT_ORG_DOMAIN)
                if (!isServiceError(inviteIdResult)) {
                    setInviteLink(`${window.location.origin}/invite?id=${inviteIdResult}`)
                }
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
                description: "Failed to copy invite link to clipboard",
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
                    <Switch
                        checked={enabled}
                        onCheckedChange={handleToggle}
                        disabled={isLoading}
                    />
                </div>
            </div>
            
            <div className={`transition-all duration-300 ease-in-out ${
                enabled 
                    ? 'max-h-96 opacity-100 transform translate-y-0 mt-4' 
                    : 'max-h-0 opacity-0 transform -translate-y-2 overflow-hidden'
            }`}>
                <div className="space-y-4 pt-4 border-t border-[var(--border)]">
                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <Input
                                value={inviteLink}
                                readOnly
                                className="flex-1 bg-[var(--muted)] border-[var(--border)] text-[var(--foreground)]"
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