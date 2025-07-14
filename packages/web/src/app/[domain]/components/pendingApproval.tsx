import { Card, CardContent } from "@/components/ui/card"
import { LogoutEscapeHatch } from "@/app/components/logoutEscapeHatch"
import { SourcebotLogo } from "@/app/components/sourcebotLogo"
import { auth } from "@/auth"

export const PendingApprovalCard = async () => {
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
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--chart-4)]/20 mx-auto">
                                    <svg className="w-8 h-8 text-[var(--chart-4)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                
                                <div className="space-y-3">
                                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                                        Pending Approval
                                    </h1>
                                    <p className="text-lg text-muted-foreground leading-relaxed max-w-sm mx-auto">
                                        Your request to join the organization is being reviewed
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                                <div className="flex space-x-1">
                                    <div className="w-2 h-2 bg-[var(--chart-1)] rounded-full animate-pulse"></div>
                                    <div className="w-2 h-2 bg-[var(--chart-1)]/60 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                    <div className="w-2 h-2 bg-[var(--chart-1)]/30 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                                </div>
                                <span>Awaiting review</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
