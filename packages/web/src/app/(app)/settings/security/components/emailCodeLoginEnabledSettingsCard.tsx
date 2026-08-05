"use client"

import { useState } from "react"
import { Info } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { setEmailCodeLoginEnabled } from "@/app/(app)/settings/security/actions"
import { isServiceError } from "@/lib/utils"
import { useToast } from "@/components/hooks/use-toast"
import { BasicSettingsCard } from "@/app/(app)/settings/components/settingsCard"

interface EmailCodeLoginEnabledSettingsCardProps {
    isEmailCodeLoginEnabled: boolean
    isEmailServiceConfigured: boolean
}

export function EmailCodeLoginEnabledSettingsCard({
    isEmailCodeLoginEnabled,
    isEmailServiceConfigured,
}: EmailCodeLoginEnabledSettingsCardProps) {
    const [enabled, setEnabled] = useState(isEmailCodeLoginEnabled)
    const [isLoading, setIsLoading] = useState(false)
    const { toast } = useToast()

    const handleToggle = async (checked: boolean) => {
        setIsLoading(true)
        try {
            const result = await setEmailCodeLoginEnabled(checked)

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
            console.error("Error updating email code login setting:", error)
            toast({
                title: "Error",
                description: "Failed to update email code login setting",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <BasicSettingsCard
            name="Email code login"
            description="When enabled, users can sign in with a one-time code sent to their email."
            footer={!isEmailServiceConfigured && (
                <Alert className="mt-4 items-center">
                    <Info className="w-4 h-4 text-muted-foreground" />
                    <AlertDescription>
                        This setting requires transactional email to be configured.{" "}
                        <a
                            href="https://docs.sourcebot.dev/docs/configuration/transactional-emails"
                            target="_blank"
                            rel="noopener"
                            className="underline text-primary hover:text-primary/80 transition-colors"
                        >
                            Learn more
                        </a>
                    </AlertDescription>
                </Alert>
            )}
        >
            <Switch
                checked={enabled}
                onCheckedChange={handleToggle}
                disabled={isLoading || (!isEmailServiceConfigured && !enabled)}
            />
        </BasicSettingsCard>
    )
}
