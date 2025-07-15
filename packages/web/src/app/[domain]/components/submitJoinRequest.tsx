import { LogoutEscapeHatch } from "@/app/components/logoutEscapeHatch"
import { SourcebotLogo } from "@/app/components/sourcebotLogo"
import { auth } from "@/auth"
import { SubmitAccountRequestButton } from "./submitAccountRequestButton"

interface SubmitJoinRequestProps {
    domain: string
}

export const SubmitJoinRequest = async ({ domain }: SubmitJoinRequestProps) => {
    const session = await auth()
    const userId = session?.user?.id

    if (!userId) {
        return null
    }

    return (
        <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-6">
            <LogoutEscapeHatch className="absolute top-0 right-0 p-6" />
            
            <div className="w-full max-w-md">
                <div className="text-center space-y-8">
                    <SourcebotLogo
                        className="h-10 mx-auto"
                        size="large"
                    />
                    
                    <div className="space-y-6">
                        <div className="w-12 h-12 mx-auto bg-[var(--primary)] rounded-full flex items-center justify-center">
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
                            <SubmitAccountRequestButton domain={domain} userId={userId} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
} 