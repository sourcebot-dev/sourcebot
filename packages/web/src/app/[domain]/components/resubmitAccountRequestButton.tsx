"use client"

import { Button } from "@/components/ui/button"
import { Clock } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/hooks/use-toast"
import { createAccountRequest } from "@/actions"
import { isServiceError } from "@/lib/utils"

interface ResubmitButtonProps {
    domain: string
    userId: string
}

export function ResubmitAccountRequestButton({ domain, userId }: ResubmitButtonProps) {
    const { toast } = useToast()
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async () => {
        setIsSubmitting(true)
        const result = await createAccountRequest(userId, domain)
        if (!isServiceError(result)) {
            toast({
                title: "Request Resubmitted",
                description: "Your request to join the organization has been resubmitted.",
                variant: "default",
            })
        } else {
            toast({
                title: "Failed to Resubmit",
                description: `There was an error resubmitting your request. Reason: ${result.message}`,
                variant: "destructive",
            })
        }

        setIsSubmitting(false)
    }

    return (
        <form action={handleSubmit}>
            <input type="hidden" name="domain" value={domain} />
            <Button
                type="submit"
                className="flex items-center gap-2"
                variant="outline"
                disabled={isSubmitting}
            >
                <Clock className="h-4 w-4" />
                {isSubmitting ? "Submitting..." : "Resubmit Request"}
            </Button>
        </form>
    )
} 