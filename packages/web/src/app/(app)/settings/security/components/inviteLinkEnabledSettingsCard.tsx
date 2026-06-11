"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Copy, Check } from "lucide-react"
import { useToast } from "@/components/hooks/use-toast"
import { setInviteLinkEnabled } from "@/app/(app)/settings/security/actions"
import { cn, isServiceError } from "@/lib/utils"
import { BasicSettingsCard } from "@/app/(app)/settings/components/settingsCard"

interface InviteLinkEnabledSettingsCardProps {
    inviteLinkEnabled: boolean
    inviteLink: string | null
}

export function InviteLinkEnabledSettingsCard({ inviteLinkEnabled, inviteLink }: InviteLinkEnabledSettingsCardProps) {
    const [enabled, setEnabled] = useState(inviteLinkEnabled)
    const [isLoading, setIsLoading] = useState(false)
    const [copied, setCopied] = useState(false)
    const { toast } = useToast()

    const handleToggle = async (checked: boolean) => {
        setIsLoading(true)
        try {
            const result = await setInviteLinkEnabled(checked)
            
            if (isServiceError(result)) {
                toast({
                    title: "Error",
                    description: "Failed to update invite link setting",
                    variant: "destructive",
                })
                return
            }

            setEnabled(checked)
            
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
        if (!inviteLink) return
        
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
        <BasicSettingsCard
            name="Enable invite links"
            description="When enabled, team members can use the invite link to join your organization without requiring approval."
            footer={
                <div className={cn(
                    "transition-all duration-300 ease-in-out",
                    enabled
                        ? "max-h-96 opacity-100 transform translate-y-0 mt-4"
                        : "max-h-0 opacity-0 transform -translate-y-2 overflow-hidden"
                )}>
                    <div className="space-y-4 pt-4 border-t border-border">
                        <div className="space-y-2">
                            <div className="flex gap-2">
                                <Input
                                    value={inviteLink || "Failed to fetch invite link: org doesn't have inviteId property."}
                                    readOnly
                                    className={cn("flex-1 bg-muted border-border", inviteLink ? "text-foreground" : "text-red-500")}
                                />
                                <Button
                                    onClick={handleCopy}
                                    variant="outline"
                                    size="icon"
                                    className="shrink-0 border-border hover:bg-muted"
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
                    </div>
                </div>
            }
        >
            <Switch
                checked={enabled}
                onCheckedChange={handleToggle}
                disabled={isLoading}
            />
        </BasicSettingsCard>
    )
}