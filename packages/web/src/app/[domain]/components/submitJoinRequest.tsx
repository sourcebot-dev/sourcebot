import { Card, CardContent } from "@/components/ui/card"
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
        <div className="flex flex-col items-center justify-center min-h-screen py-24 bg-background text-foreground relative">
            <LogoutEscapeHatch className="absolute top-0 right-0 p-6" />

            <div className="w-full max-w-lg mx-auto">
                <Card className="shadow-xl border-0 bg-card/95 backdrop-blur-sm">
                    <CardContent className="pt-12 pb-16 px-12">
                        <div className="text-center space-y-8">
                            <SourcebotLogo
                                className="h-12 mx-auto"
                                size="large"
                            />
                            
                            <div className="space-y-4">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--highlight)]/20 mx-auto">
                                    <svg className="w-8 h-8 text-[var(--highlight)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                    </svg>
                                </div>
                                
                                <div className="space-y-3">
                                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                                        Join Organization
                                    </h1>
                                    <p className="text-lg text-muted-foreground leading-relaxed max-w-sm mx-auto">
                                        Submit a request to join this organization
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-center">
                                    <SubmitAccountRequestButton domain={domain} userId={userId} />
                                </div>
                                
                                <p className="text-sm text-muted-foreground">
                                    Your request will be reviewed by an organization owner
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
} 