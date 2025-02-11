"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { isServiceError } from "@/lib/utils"
import { useToast } from "@/components/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { createCheckoutSession } from "../../../actions"

export function CheckoutButton() {
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()
    const { toast } = useToast()

    const handleCheckoutSession = async () => {
        setIsLoading(true)
        try {
            const session = await createCheckoutSession()
            if (isServiceError(session)) {
                console.log("Failed to create checkout session: ", session)
                toast({
                    title: "Error",
                    description: "Failed to create checkout session. Please try again.",
                    variant: "destructive",
                })
            } else {
                router.push(session.url!)
            }
        } catch (error) {
            console.error("Error creating checkout session:", error)
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
        <Button onClick={handleCheckoutSession} disabled={isLoading}>
          {isLoading ? "Checkout out..." : "Checkout"}
        </Button>
      )
}