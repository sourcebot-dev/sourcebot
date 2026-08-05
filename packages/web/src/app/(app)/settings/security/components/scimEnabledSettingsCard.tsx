"use client"

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { setScimEnabled } from "@/ee/features/scim/actions"
import { isServiceError } from "@/lib/utils"
import { useToast } from "@/components/hooks/use-toast"
import { BasicSettingsCard } from "@/app/(app)/settings/components/settingsCard"
import { useRouter } from "next/navigation"

interface ScimEnabledSettingsCardProps {
    isScimEnabled: boolean
}

export const ScimEnabledSettingsCard = ({
    isScimEnabled,
}: ScimEnabledSettingsCardProps) => {
    const [enabled, setEnabled] = useState(isScimEnabled)
    const [isLoading, setIsLoading] = useState(false)
    // The toggle value awaiting confirmation; null when no dialog is open.
    const [pendingChange, setPendingChange] = useState<boolean | null>(null)
    const { toast } = useToast()
    const router = useRouter()

    // Both directions change how membership is governed, so confirm either way.
    const handleToggle = (checked: boolean) => {
        setPendingChange(checked)
    }

    const applyToggle = async (checked: boolean) => {
        setIsLoading(true)
        try {
            const result = await setScimEnabled(checked)

            if (isServiceError(result)) {
                toast({
                    title: "Error",
                    description: result.message,
                    variant: "destructive",
                })
                return
            }

            setEnabled(checked)
            router.refresh()
        } catch (error) {
            console.error("Error updating SCIM provisioning setting:", error)
            toast({
                title: "Error",
                description: "Failed to update SCIM provisioning setting",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <>
            <BasicSettingsCard
                name="Enable SCIM provisioning"
                description="When enabled, your identity provider can provision and deprovision members via SCIM."
            >
                <Switch
                    checked={enabled}
                    onCheckedChange={handleToggle}
                    disabled={isLoading}
                />
            </BasicSettingsCard>

            <AlertDialog
                open={pendingChange !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingChange(null)
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {pendingChange === false ? "Disable SCIM provisioning?" : "Enable SCIM provisioning?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingChange === false
                                ? "Members will no longer be synced from your identity provider. Existing members keep their access. Your SCIM tokens aren't revoked, but they'll stop working until you re-enable SCIM."
                                : "Your identity provider will become the source of truth for membership. While SCIM is enabled, invite links, member approval, and join requests are disabled. Members can only be added or removed through your IdP."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (pendingChange !== null) {
                                    void applyToggle(pendingChange)
                                }
                            }}
                            disabled={isLoading}
                        >
                            {pendingChange === false ? "Disable" : "Enable"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
