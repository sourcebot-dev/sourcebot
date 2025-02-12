"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { redeemInvite } from "../../../actions";
import { isServiceError } from "@/lib/utils"
import { useToast } from "@/components/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Invite } from "@sourcebot/db"

interface AcceptInviteButtonProps {
    invite: Invite
    userId: string
}

export function AcceptInviteButton({ invite, userId }: AcceptInviteButtonProps) {
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()
    const { toast } = useToast()

    const handleAcceptInvite = async () => {
        setIsLoading(true)
        try {
            const res = await redeemInvite(invite, userId)
            if (isServiceError(res)) {
                console.log("Failed to redeem invite: ", res)
                toast({
                    title: "Error",
                    description: "Failed to redeem invite. Please try again.",
                    variant: "destructive",
                })
            } else {
                router.push("/")
            }
        } catch (error) {
            console.error("Error redeeming invite:", error)
            toast({
                title: "Error",
                description: "An unexpected error occurred. Please try again.",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Button onClick={handleAcceptInvite} disabled={isLoading}>
            {isLoading ? "Accepting..." : "Accept Invite"}
        </Button>
    )
}

