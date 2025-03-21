"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, useMemo } from 'react'
import { useState } from "react"
import { Copy, CheckCircle2, TriangleAlert } from "lucide-react"
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { serviceErrorSchema } from '@/lib/serviceError';
import { SourcebotLogo } from './components/sourcebotLogo';

export default function Error({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    const { message, errorCode, statusCode } = useMemo(() => {

        try {
            const body = JSON.parse(error.message);
            const { success, data: serviceError } = serviceErrorSchema.safeParse(body);
            if (success) {
                return {
                    message: serviceError.message,
                    errorCode: serviceError.errorCode,
                    statusCode: serviceError.statusCode,
                }
            }
        /* eslint-disable no-empty */
        } catch {}

        return {
            message: error.message,
        }
    }, [error]);

    return (
        <div className="flex flex-col min-h-screen justify-center items-center bg-backgroundSecondary">
            <SourcebotLogo
                className="mb-4"
                size='large'
            />
            <ErrorCard
                message={message}
                errorCode={errorCode}
                statusCode={statusCode}
                onReloadButtonClicked={reset}
            />
        </div>
    )
}

interface ErrorCardProps {
    message: string
    errorCode?: string | number
    statusCode?: string | number
    onReloadButtonClicked: () => void
}

function ErrorCard({ message, errorCode, statusCode, onReloadButtonClicked }: ErrorCardProps) {
    const [copied, setCopied] = useState<string | null>(null)

    const copyToClipboard = (text: string, field: string) => {
        navigator.clipboard.writeText(text)
        setCopied(field)
        setTimeout(() => setCopied(null), 2000)
    }

    return (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader className="space-y-1 flex">
                <CardTitle className="text-2xl font-bold flex items-center gap-2 text-destructive">
                    <TriangleAlert className="h-5 w-5 mt-0.5" />
                    Unexpected Error
                </CardTitle>
                <CardDescription className="text-sm">
                    An unexpected error occurred. Please reload the page and try again. If the issue persists, <Link href={`mailto:team@sourcebot.dev?subject=Sourcebot%20Error%20Report${errorCode ? `%20|%20Code:%20${errorCode}` : ''}`} className='underline'>please contact us</Link>.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-3">
                    <ErrorField
                        label="Error Message"
                        value={message}
                        onCopy={() => copyToClipboard(message, "message")}
                        copied={copied === "message"}
                    />

                    {errorCode && (
                        <ErrorField
                            label="Error Code"
                            value={errorCode}
                            onCopy={() => copyToClipboard(errorCode.toString(), "errorCode")}
                            copied={copied === "errorCode"}
                        />
                    )}

                    {statusCode && (
                        <ErrorField
                            label="Status Code"
                            value={statusCode}
                            onCopy={() => copyToClipboard(statusCode.toString(), "statusCode")}
                            copied={copied === "statusCode"}
                        />
                    )}
                </div>
                <Button
                    onClick={onReloadButtonClicked}
                    variant='outline'
                    className='w-full'
                >
                    Reload Page
                </Button>
            </CardContent>
        </Card>
    )
}

interface ErrorFieldProps {
    label: string
    value: string | number
    onCopy: () => void
    copied: boolean
}

function ErrorField({ label, value, onCopy, copied }: ErrorFieldProps) {
    return (
        <div className="space-y-2">
            <div className="text-sm font-medium">{label}</div>
            <div className="flex items-center gap-2">
                <div className="bg-muted p-2 rounded text-sm flex-1 break-words">{value}</div>
                <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={onCopy}
                    aria-label={`Copy ${label.toLowerCase()}`}
                >
                    {copied ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                        <Copy className="h-4 w-4" />
                    )}
                </Button>
            </div>
        </div>
    )
}