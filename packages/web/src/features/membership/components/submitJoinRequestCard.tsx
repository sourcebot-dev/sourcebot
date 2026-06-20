'use client';

import { LogoutEscapeHatch } from "@/app/components/logoutEscapeHatch"
import { SourcebotLogo } from "@/app/components/sourcebotLogo"
import { useToast } from "@/components/hooks/use-toast"
import { LoadingButton } from "@/components/ui/loading-button";
import { createAccountRequest } from "@/features/membership/actions"
import { isServiceError } from "@/lib/utils"
import { Clock } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

export const SubmitJoinRequestCard = () => {
    const { toast } = useToast()
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async () => {
        setIsSubmitting(true)
        const result = await createAccountRequest()
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
        }
        setIsSubmitting(false)
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-6">
            <LogoutEscapeHatch className="absolute top-0 right-0 p-6" />

            <div className="w-full max-w-md">
                <div className="text-center space-y-8">
                    <SourcebotLogo
                        className="h-10 mx-auto"
                        size="large"
                    />

                    <div className="space-y-6">
                        <div className="w-12 h-12 mx-auto bg-primary rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-[var(--primary-foreground)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                        </div>

                        <div className="space-y-2">
                            <h1 className="text-2xl font-semibold text-[var(--foreground)]">
                                Request Access
                            </h1>
                            <p className="text-[var(--muted-foreground)] text-base">
                                Submit a request to join this organization
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-center">
                            <LoadingButton
                                type="submit"
                                className="flex items-center gap-2"
                                variant="outline"
                                loading={isSubmitting}
                                onClick={handleSubmit}
                            >
                                {!isSubmitting && <Clock className="h-4 w-4" />}
                                Submit Request
                            </LoadingButton>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
