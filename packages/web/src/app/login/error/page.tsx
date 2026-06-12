"use client"

import { Card, CardHeader, CardDescription, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, AlertCircle } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Link from "next/link"
import { SourcebotLogo } from "@/app/components/sourcebotLogo"
import { Footer } from "@/app/components/footer"
import { SOURCEBOT_SUPPORT_EMAIL } from "@/lib/constants"

// @see https://authjs.dev/guides/pages/error
const ERROR_CONTENT: Record<string, { title: string; description: string }> = {
    Configuration: {
        title: "Server configuration error",
        description: "There is a problem with the server's authentication configuration. Please contact your administrator.",
    },
    AccessDenied: {
        title: "Access denied",
        description: "You do not have permission to sign in.",
    },
    Verification: {
        title: "This sign-in link has expired",
        description: "The code or link you used is no longer valid - it may have expired or already been used. Request a new one and try again.",
    },
    Default: {
        title: "Unable to sign in",
        description: "Something went wrong while signing you in. Please try again.",
    },
}

function ErrorPageContent() {
    const searchParams = useSearchParams()
    const error = searchParams.get("error") ?? "Default"
    const { title, description } = ERROR_CONTENT[error] ?? ERROR_CONTENT.Default

    return (
        <div className="flex flex-col min-h-screen">
            <div className="flex-1 flex flex-col items-center p-4 sm:p-12 w-full bg-backgroundSecondary">
                <div className="w-full max-w-md">
                    <div className="flex justify-center mb-6">
                        <SourcebotLogo className="h-16" size="large" />
                    </div>
                    <Card className="w-full">
                        <CardHeader className="space-y-3">
                            <div className="flex justify-center">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                                    <AlertCircle className="h-6 w-6 text-destructive" />
                                </div>
                            </div>
                            <CardTitle className="text-2xl text-center">{title}</CardTitle>
                            <CardDescription className="text-center">
                                {description}
                            </CardDescription>
                        </CardHeader>

                        <CardContent>
                            <Button asChild className="w-full">
                                <Link href="/login">
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Back to login
                                </Link>
                            </Button>
                        </CardContent>

                        <CardFooter className="pt-0">
                            <div className="w-full text-center text-sm text-muted-foreground">
                                <p>
                                    Having trouble?{" "}
                                    <a href={`mailto:${SOURCEBOT_SUPPORT_EMAIL}`} className="text-primary hover:underline">
                                        Contact support
                                    </a>
                                </p>
                            </div>
                        </CardFooter>
                    </Card>
                </div>
            </div>
            <Footer />
        </div>
    )
}

function LoadingErrorPage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-backgroundSecondary">
            <div className="w-full max-w-md">
                <div className="flex justify-center mb-6">
                    <SourcebotLogo className="h-16" size="large" />
                </div>
                <Card className="w-full">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl font-semibold text-center">Loading...</CardTitle>
                    </CardHeader>
                </Card>
            </div>
        </div>
    )
}

export default function AuthErrorPage() {
    return (
        <Suspense fallback={<LoadingErrorPage />}>
            <ErrorPageContent />
        </Suspense>
    )
}
