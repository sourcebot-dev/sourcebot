"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { completeOnboarding } from "@/actions"
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants"
import { isServiceError } from "@/lib/utils"
import { useToast } from "@/components/hooks/use-toast"

export function CompleteOnboardingButton() {
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()
    const { toast } = useToast()

    const handleCompleteOnboarding = async () => {
        setIsLoading(true)
        
        try {
            const result = await completeOnboarding(SINGLE_TENANT_ORG_DOMAIN)
            
            if (isServiceError(result)) {
                toast({
                    title: "Error",
                    description: "Failed to complete onboarding. Please try again.",
                    variant: "destructive",
                })
                setIsLoading(false)
                return
            }
            
            router.push("/")
        } catch (error) {
            console.error("Error completing onboarding:", error)
            toast({
                title: "Error",
                description: "Failed to complete onboarding. Please try again.",
                variant: "destructive",
            })
            setIsLoading(false)
        }
    }

    return (
        <Button 
            onClick={handleCompleteOnboarding}
            disabled={isLoading}
            className="w-full"
        >
            {isLoading ? "Completing..." : "Complete Onboarding →"}
        </Button>
    )
} 