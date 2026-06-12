"use client"

import { InputOTPSeparator } from "@/components/ui/input-otp"
import { InputOTPGroup } from "@/components/ui/input-otp"
import { InputOTPSlot } from "@/components/ui/input-otp"
import { InputOTP } from "@/components/ui/input-otp"
import { Card, CardHeader, CardDescription, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useCallback, useState, Suspense } from "react"
import { SourcebotLogo } from "@/app/components/sourcebotLogo"
import useCaptureEvent from "@/hooks/useCaptureEvent"
import { Footer } from "@/app/components/footer"
import { SOURCEBOT_SUPPORT_EMAIL } from "@/lib/constants"
import { Redirect } from "@/app/components/redirect"

function VerifyPageContent() {
    const [value, setValue] = useState("")
    const [isVerifying, setIsVerifying] = useState(false)
    const searchParams = useSearchParams()
    const email = searchParams.get("email")
    const captureEvent = useCaptureEvent();

    const handleSubmit = useCallback((code: string) => {
        if (isVerifying || !email || code.length !== 6) {
            return
        }

        setIsVerifying(true)
        const url = new URL("/api/auth/callback/nodemailer", window.location.origin)
        url.searchParams.set("token", code)
        url.searchParams.set("email", email)
        // Use a full-page navigation (not router.push) so the auth callback's
        // session cookie + 302 redirect are applied by the browser, and the
        // one-time token isn't consumed twice by a client-side RSC navigation.
        window.location.href = url.toString()
    }, [email, isVerifying])

    // Auto-submit once the full 6-digit code is entered. Pass the new value
    // directly rather than reading `value`, which hasn't been committed yet.
    const handleValueChange = (newValue: string) => {
        setValue(newValue)
        if (newValue.length === 6) {
            handleSubmit(newValue)
        }
    }

    if (!email) {
        captureEvent("wa_login_verify_page_no_email", {})
        return <Redirect
            to="/login"
        />
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSubmit(value)
        }
    }

    return (
        <div className="flex flex-col min-h-screen">
            <div className="flex-1 flex flex-col items-center p-4 sm:p-12 w-full bg-backgroundSecondary">
                <div className="w-full max-w-md">
                    <div className="flex justify-center mb-6">
                        <SourcebotLogo className="h-16" size="large" />
                    </div>
                    <Card className="w-full">
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-2xl font-semibold text-center">Verify your email</CardTitle>
                            <CardDescription className="text-center">
                                Enter the 6-digit code we sent to <span className="font-semibold text-primary">{email}</span>
                            </CardDescription>
                        </CardHeader>

                        <CardContent>
                            <form onSubmit={(e) => {
                                e.preventDefault()
                                handleSubmit(value)
                            }} className="space-y-6">
                                <div className="flex justify-center py-4">
                                    <InputOTP maxLength={6} value={value} onChange={handleValueChange} onKeyDown={handleKeyDown} disabled={isVerifying} className="gap-2">
                                        <InputOTPGroup>
                                            <InputOTPSlot index={0} />
                                            <InputOTPSlot index={1} />
                                            <InputOTPSlot index={2} />
                                        </InputOTPGroup>
                                        <InputOTPSeparator />
                                        <InputOTPGroup>
                                            <InputOTPSlot index={3} />
                                            <InputOTPSlot index={4} />
                                            <InputOTPSlot index={5} />
                                        </InputOTPGroup>
                                    </InputOTP>
                                </div>
                                {isVerifying && (
                                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Verifying...
                                    </div>
                                )}
                            </form>
                        </CardContent>

                        <CardFooter className="flex flex-col space-y-4 pt-0">
                            <Button variant="ghost" className="w-full text-sm" size="sm" onClick={() => window.history.back()}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to login
                            </Button>
                        </CardFooter>
                    </Card>
                    <div className="mt-8 text-center text-sm text-muted-foreground">
                        <p>
                            Having trouble?{" "}
                            <a href={`mailto:${SOURCEBOT_SUPPORT_EMAIL}`} className="text-primary hover:underline">
                                Contact support
                            </a>
                        </p>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    )
}

function LoadingVerifyPage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-background to-muted/30">
            <div className="w-full max-w-md">
                <div className="flex justify-center mb-6">
                    <SourcebotLogo className="h-16" size="large" />
                </div>
                <Card className="w-full shadow-lg border-muted/40">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl font-bold text-center">Loading...</CardTitle>
                    </CardHeader>
                </Card>
            </div>
        </div>
    )
}

export function VerifyForm() {
    return (
        <Suspense fallback={<LoadingVerifyPage />}>
            <VerifyPageContent />
        </Suspense>
    )
}
