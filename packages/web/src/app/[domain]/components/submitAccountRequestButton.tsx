"use client"

import { Button } from "@/components/ui/button"
import { Clock } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/hooks/use-toast"
import { createAccountRequest } from "@/actions"
import { isServiceError } from "@/lib/utils"
import { useRouter } from "next/navigation"

interface SubmitButtonProps {
    domain: string
    userId: string
}

export function SubmitAccountRequestButton({ domain, userId }: SubmitButtonProps) {
    const { toast } = useToast()
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async () => {
        setIsSubmitting(true)
        const result = await createAccountRequest(userId, domain)
        if (!isServiceError(result)) {
            if (result.existingRequest) {
                toast({
                    title: "Request Already Submitted",
                    description: "Your request to join the organization has already been submitted. Please wait for it to be approved.",
                    variant: "default",
                })
            } else {
                toast({
                    title: "Request Submitted",
                    description: "Your request to join the organization has been submitted.",
                    variant: "default",
                })
            }
            // Refresh the page to trigger layout re-render and show PendingApprovalCard
            router.refresh()
        } else {
            toast({
                title: "Failed to Submit",
                description: `There was an error submitting your request. Reason: ${result.message}`,
                variant: "destructive",
            })
            setIsSubmitting(false)
        }
    }

    return (
        <form onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
        }}>
            <input type="hidden" name="domain" value={domain} />
            <Button
                type="submit"
                className="flex items-center gap-2"
                variant="outline"
                disabled={isSubmitting}
            >
                <Clock className="h-4 w-4" />
                {isSubmitting ? "Submitting..." : "Submit Request"}
            </Button>
        </form>
    )
} 