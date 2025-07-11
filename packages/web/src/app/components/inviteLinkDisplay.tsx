"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Copy, Check } from "lucide-react"
import { useToast } from "@/components/hooks/use-toast"
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants"
import { getOrgInviteId } from "@/actions"

export function InviteLinkDisplay() {
    const [inviteLink, setInviteLink] = useState("")
    const [copied, setCopied] = useState(false)
    const { toast } = useToast()

    useEffect(() => {
        const fetchInviteId = async () => {
            const inviteId = await getOrgInviteId(SINGLE_TENANT_ORG_DOMAIN);
            if (typeof window !== "undefined") {
                setInviteLink(`${window.location.origin}/invite?id=${inviteId}`)
            }
        }
        fetchInviteId().catch(console.error);
    }, [])

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
        <div className="space-y-4">
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
                            <Check className="h-4 w-4 text-green-600" />
                        ) : (
                            <Copy className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </div>
            
            <p className="text-sm text-[var(--muted-foreground)]">
                You can find this link in the <strong>Settings → Members</strong> page.
                <br /><br />
                <strong>Note:</strong> Sign ups without an invite need to be approved by the owner.{" "}
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
    )
} 