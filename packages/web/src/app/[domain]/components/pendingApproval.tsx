import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { HelpCircle } from "lucide-react"
import { LogoutEscapeHatch } from "@/app/components/logoutEscapeHatch"
import { SourcebotLogo } from "@/app/components/sourcebotLogo"
import { auth } from "@/auth"
import { ResubmitAccountRequestButton } from "./resubmitAccountRequestButton"

interface PendingApprovalCardProps {
    domain: string
}

export const PendingApprovalCard = async ({ domain }: PendingApprovalCardProps) => {
    const session = await auth()
    const userId = session?.user?.id

    if (!userId) {
        return null
    }

    console.log(`userId: ${userId} domain: ${domain}`)

    return (
        <div className="flex flex-col items-center justify-center min-h-screen py-24 bg-background text-foreground relative">
            <LogoutEscapeHatch className="absolute top-0 right-0 p-6" />

            <div className="w-full max-w-md mx-auto">
                <Card className="shadow-xl">
                    <CardHeader className="pb-4">
                        <SourcebotLogo
                            className="h-16 w-auto mx-auto mb-2"
                            size="large"
                        />
                        <CardTitle className="text-2xl font-bold text-center">Pending Approval</CardTitle>
                        <CardDescription className="text-center mt-2">
                            Your request to join the organization is being reviewed
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <div className="flex flex-col items-center space-y-2 mt-4">
                            <ResubmitAccountRequestButton domain={domain} userId={userId} />
                        </div>
                        <div className="flex justify-center">
                            <div className="inline-flex items-center space-x-3 p-3 bg-muted/50 rounded-md">
                                <HelpCircle className="h-5 w-5 text-primary" />
                                <div className="text-sm text-muted-foreground text-center">
                                    <p>Need help or have questions?</p>
                                    <a
                                        href="https://github.com/sourcebot-dev/sourcebot/discussions/categories/support"
                                        className="text-primary hover:text-primary/80 underline underline-offset-2"
                                    >
                                        Submit a support request
                                    </a>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
