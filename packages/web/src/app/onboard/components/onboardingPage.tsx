import type React from "react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AuthMethodSelector } from "@/app/components/authMethodSelector"
import { InviteLinkDisplay } from "@/app/components/inviteLinkDisplay"
import { SourcebotLogo } from "@/app/components/sourcebotLogo"
import { auth } from "@/auth";
import type { AuthProvider } from "@/lib/authProviders";

interface OnboardingPageProps {
    providers: AuthProvider[];
    searchParams?: { step?: string };
}

interface OnboardingStep {
    id: string
    title: string
    description: string
    component: React.ReactNode
}

export default async function OnboardingPage({ providers, searchParams }: OnboardingPageProps) {
    const session = await auth();

    // Determine current step based on URL parameter and authentication state
    const stepParam = searchParams?.step ? parseInt(searchParams.step) : 0;
    const currentStep = session?.user ? Math.max(2, stepParam) : Math.max(0, Math.min(stepParam, 1));

    const steps: OnboardingStep[] = [
        {
            id: "welcome",
            title: "Welcome to Sourcebot",
            description:
                "Your deployment is live and ready. Let's set up your owner account and organization in just a few steps.",
            component: (
                <div className="space-y-6">
                    <div className="space-y-4">
                        <p className="text-[var(--muted-foreground)] text-[15px] leading-7">
                            The owner account grants the highest level of access in your Sourcebot deployment. Once your organization is created, you can invite team members or allow them to request access.
                        </p>
                    </div>
                    <Button asChild className="w-full h-11 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)] transition-all duration-200 font-medium">
                        <a href="/onboard?step=1">Get Started →</a>
                    </Button>
                </div>
            ),
        },
        {
            id: "owner-signup",
            title: "Create Owner Account",
            description:
                "Set up your administrator account with secure credentials. Store your password safely—we cannot recover it for you.",
            component: (
                <div className="space-y-6">
                    <div className="p-4 rounded-lg bg-[var(--highlight)]/10 border border-[var(--highlight)]/20">
                        <p className="text-sm text-[var(--highlight)] leading-6 flex items-start gap-2">
                            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            <span><strong>Security Notice:</strong> Authentication data is managed by your deployment and is encrypted at rest. Zero data leaves your deployment.</span>
                        </p>
                    </div>
                    <AuthMethodSelector
                        providers={providers}
                        callbackUrl="/onboard"
                        context="signup"
                    />
                </div>
            ),
        },
        {
            id: "invite-members",
            title: "Invite Your Team",
            description:
                "Share the invitation link with your team members to get everyone set up and collaborating.",
            component: (
                <div className="space-y-6">
                    <div className="space-y-4">
                        <p className="text-[var(--muted-foreground)] text-[15px] leading-7">
                            Share the invite link with your team members to allow them to sign up to your Sourcebot deployment.
                        </p>
                    </div>
                    <InviteLinkDisplay />
                    <Button asChild className="w-full h-11 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)] transition-all duration-200 font-medium">
                        <a href="/onboard?step=3">Continue →</a>
                    </Button>
                </div>
            ),
        },
        {
            id: "complete",
            title: "You're All Set!",
            description:
                "Your Sourcebot deployment is ready. Start exploring code, setting up repositories, and collaborating with your team.",
            component: (
                <div className="space-y-6">
                    <div className="text-center space-y-4">
                        <div className="w-16 h-16 mx-auto bg-[var(--chart-2)] rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-[var(--foreground)]">Setup Complete</h3>
                            <p className="text-[var(--muted-foreground)] text-sm leading-6">
                                Your deployment is configured and ready for development workflows.
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                        <a 
                            href="https://docs.sourcebot.dev/docs/connections/overview"
                            target="_blank"
                            rel="noopener"
                            className="p-4 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent)]/80 border border-[var(--border)] hover:border-[var(--primary)]/20 transition-all duration-200 group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-md bg-[var(--primary)]/10 flex items-center justify-center group-hover:bg-[var(--primary)]/20 transition-colors">
                                    <svg className="w-4 h-4 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 1.79 4 4 4h8c2.21 0 4-1.79 4-4V7M4 7c0-2.21 1.79-4 4-4h8c2.21 0 4 1.79 4 4M4 7h16M8 11h8m-8 4h8" />
                                    </svg>
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="font-medium text-[var(--foreground)] text-sm group-hover:text-[var(--primary)] transition-colors">
                                        Index your repos
                                    </div>
                                    <div className="text-[var(--muted-foreground)] text-xs mt-1 leading-4">
                                        Learn how to index repos across Sourcebot's supported platforms
                                    </div>
                                </div>
                                <svg className="w-4 h-4 text-[var(--muted-foreground)] group-hover:text-[var(--primary)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </div>
                        </a>
                    </div>
                    <Button asChild className="w-full h-11 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)] transition-all duration-200 font-medium">
                        <a href="/">Go to Dashboard →</a>
                    </Button>
                </div>
            ),
        },
    ]

    const currentStepData = steps[currentStep]

    return (
        <div className="min-h-screen bg-gradient-to-br from-[var(--background)] to-[var(--accent)]/30 flex items-center justify-center p-6">
            <div className="w-full max-w-6xl mx-auto">
                <Card className="overflow-hidden shadow-2xl border-0 bg-[var(--card)]/95 backdrop-blur-sm">
                    <CardContent className="p-0">
                        <div className="flex min-h-[700px]">
                            {/* Left Panel - Progress & Context */}
                            <div className="w-2/5 bg-gradient-to-br from-[var(--card)] to-[var(--accent)]/50 p-10 border-r border-[var(--border)]/50">
                                <div className="h-full flex flex-col">
                                    <div className="flex-1">
                                        <div className="mb-8">
                                            <SourcebotLogo
                                                className="h-12 mb-6"
                                                size="large"
                                            />
                                            <h1 className="text-4xl font-bold text-[var(--foreground)] mb-4 leading-tight">
                                                {currentStepData.title}
                                            </h1>
                                            <p className="text-[var(--muted-foreground)] text-lg leading-8 font-normal">
                                                {currentStepData.description}
                                            </p>
                                        </div>

                                        {/* Enhanced Step Indicators */}
                                        <div className="space-y-6">
                                            {steps.map((step, index) => (
                                                <div key={step.id} className="flex items-center group">
                                                    <div className="flex items-center space-x-4 flex-1">
                                                        <div className="relative">
                                                            <div
                                                                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-semibold text-sm transition-all duration-300 ${
                                                                    index < currentStep
                                                                        ? "bg-[var(--chart-2)] border-[var(--chart-2)] text-white"
                                                                        : index === currentStep
                                                                            ? "bg-[var(--chart-1)] border-[var(--chart-1)] text-white scale-110"
                                                                            : "bg-[var(--background)] border-[var(--muted)] text-[var(--muted-foreground)]"
                                                                }`}
                                                            >
                                                                {index < currentStep ? (
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                ) : (
                                                                    <span>{index + 1}</span>
                                                                )}
                                                            </div>
                                                            {index < steps.length - 1 && (
                                                                <div 
                                                                    className={`absolute top-10 left-1/2 transform -translate-x-1/2 w-0.5 h-6 transition-all duration-300 ${
                                                                        index < currentStep ? "bg-[var(--chart-2)]" : "bg-[var(--muted)]"
                                                                    }`}
                                                                />
                                                            )}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className={`font-semibold transition-all duration-200 ${
                                                                index <= currentStep ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"
                                                            }`}>
                                                                {step.title}
                                                            </div>
                                                            <div className={`text-sm mt-1 transition-all duration-200 ${
                                                                index === currentStep ? "text-[var(--muted-foreground)]" : "text-[var(--muted-foreground)]/60"
                                                            }`}>
                                                                {index === 0 && "Get started with setup"}
                                                                {index === 1 && "Create your admin account"}
                                                                {index === 2 && "Add team members"}
                                                                {index === 3 && "Start using Sourcebot"}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="pt-8 border-t border-[var(--border)]/30">
                                        <p className="text-xs text-[var(--muted-foreground)] leading-5">
                                            Need help? Check out our{" "}
                                            <a
                                                href="https://docs.sourcebot.dev/docs/overview"
                                                className="text-[var(--primary)] hover:underline font-medium"
                                                target="_blank"
                                                rel="noopener"
                                            >
                                                documentation
                                            </a>{" "}
                                            or{" "}
                                            <a
                                                href="https://github.com/sourcebot-dev/sourcebot/discussions"
                                                className="text-[var(--primary)] hover:underline font-medium"
                                                target="_blank"
                                                rel="noopener"
                                            >
                                                reach out
                                            </a>
                                            .
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Right Panel - Form Content */}
                            <div className="w-3/5 bg-[var(--background)] p-10">
                                <div className="h-full flex flex-col justify-center max-w-md mx-auto">
                                    <div className="transition-all duration-300 ease-out">
                                        {currentStepData.component}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
