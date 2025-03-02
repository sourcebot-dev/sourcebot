"use client"

import { InputOTPSeparator } from "@/components/ui/input-otp"
import { InputOTPGroup } from "@/components/ui/input-otp"
import { InputOTPSlot } from "@/components/ui/input-otp"
import { InputOTP } from "@/components/ui/input-otp"
import { Card, CardHeader, CardDescription, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useState } from "react"
import VerificationFailed from "./verificationFailed"
import { SourcebotLogo } from "@/app/components/sourcebotLogo"
import useCaptureEvent from "@/hooks/useCaptureEvent"

export default function VerifyPage() {
    const [value, setValue] = useState("")
    const searchParams = useSearchParams()
    const email = searchParams.get("email")
    const router = useRouter()
    const captureEvent = useCaptureEvent();

    if (!email) {
        captureEvent("wa_login_verify_page_no_email", {})
        return <VerificationFailed />
    }

    const handleSubmit = useCallback(async () => {
        const url = new URL("/api/auth/callback/nodemailer", window.location.origin)
        url.searchParams.set("token", value)
        url.searchParams.set("email", email)
        router.push(url.toString())
    }, [value])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && value.length === 6) {
            handleSubmit()
        }
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-background to-muted/30">
            <div className="w-full max-w-md">
                <div className="flex justify-center mb-6">
                    <SourcebotLogo className="h-16" size="large" />
                </div>
                <Card className="w-full shadow-lg border-muted/40">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl font-bold text-center">Verify your email</CardTitle>
                        <CardDescription className="text-center">
                            Enter the 6-digit code we sent to <span className="font-semibold text-primary">{email}</span>
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <form onSubmit={(e) => {
                            e.preventDefault()
                            if (value.length === 6) {
                                handleSubmit()
                            }
                        }} className="space-y-6">
                            <div className="flex justify-center py-4">
                                <InputOTP maxLength={6} value={value} onChange={setValue} onKeyDown={handleKeyDown} className="gap-2">
                                    <InputOTPGroup>
                                        <InputOTPSlot index={0} className="rounded-md border-input" />
                                        <InputOTPSlot index={1} className="rounded-md border-input" />
                                        <InputOTPSlot index={2} className="rounded-md border-input" />
                                    </InputOTPGroup>
                                    <InputOTPSeparator />
                                    <InputOTPGroup>
                                        <InputOTPSlot index={3} className="rounded-md border-input" />
                                        <InputOTPSlot index={4} className="rounded-md border-input" />
                                        <InputOTPSlot index={5} className="rounded-md border-input" />
                                    </InputOTPGroup>
                                </InputOTP>
                            </div>
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
                        <a href="mailto:team@sourcebot.dev" className="text-primary hover:underline">
                            Contact support
                        </a>
                    </p>
                </div>
            </div>
        </div>
    )
}

