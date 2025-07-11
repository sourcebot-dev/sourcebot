import type React from "react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AuthMethodSelector } from "@/app/components/authMethodSelector"
import { InviteLinkDisplay } from "@/app/components/inviteLinkDisplay"
import { auth } from "@/auth";

interface OnboardingPageProps {
    providers: Array<{ id: string; name: string }>;
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
            title: "Welcome!",
            description:
                "Your Sourcebot deployment is live and ready to use. This step by step guide will help you set up your owner account and organization.",
            component: (
                <div className="space-y-4">
                    <p className="text-[var(--muted-foreground)]">
                        The owner account is the highest level of access in your Sourcebot deployment. After your organization is created, you can invite others to join, or
                        they can sign up and request access themselves.
                    </p>
                    <Button asChild className="w-full bg-[var(--primary)] hover:bg-[var(--primary)] text-[var(--primary-foreground)]">
                        <a href="/onboard?step=1">Get Started</a>
                    </Button>
                </div>
            ),
        },
        {
            id: "owner-signup",
            title: "Create Owner Account",
            description:
                "Please store your password in a safe place. We do not store your password and cannot recover it for you.",
            component: (
                <AuthMethodSelector
                    providers={providers}
                    callbackUrl="/onboard"
                    context="signup"
                />
            ),
        },
        {
            id: "invite-members",
            title: "Invite Members",
            description:
                "Invite your team members to join your organization. They will receive an email with a link to sign up.",
            component: (
                <div className="space-y-6">
                    <p className="text-[var(--muted-foreground)]">
                        Share the link below with your team members to allow them to join your organization.
                    </p>
                    <InviteLinkDisplay />
                    <Button asChild className="w-full bg-[var(--primary)] hover:bg-[var(--primary)] text-[var(--primary-foreground)]">
                        <a href="/onboard?step=3">Continue</a>
                    </Button>
                </div>
            ),
        },
        {
            id: "complete",
            title: "Setup Complete!",
            description:
                "Your Tabby server is now ready to use. You can start inviting team members and managing your workspace.",
            component: (
                <div className="space-y-4">
                    {/* Use a server-side redirect or a link */}
                    <Button asChild className="w-full bg-[var(--primary)] hover:bg-[var(--primary)] text-[var(--primary-foreground)]">
                        <a href={`/`}>Go to Dashboard</a>
                    </Button>
                </div>
            ),
        },
    ]

    const currentStepData = steps[currentStep]

    return (
        <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
            <Card className="w-full max-w-4xl shadow-lg bg-[var(--card)] text-[var(--card-foreground)]">
                <CardContent className="p-0">
                    <div className="flex min-h-[600px]">
                        {/* Left Panel - Welcome/Progress */}
                        <div className="w-1/2 bg-[var(--card)] p-8 border-r border-[var(--border)]">
                            <div className="h-full flex flex-col">
                                <div className="flex-1">
                                    <h1 className="text-3xl font-bold text-[var(--foreground)] mb-4">{currentStepData.title}</h1>
                                    <p className="text-[var(--muted-foreground)] mb-6 leading-relaxed">{currentStepData.description}</p>

                                    {/* Step indicator */}
                                    <div className="space-y-3">
                                        {steps.map((step, index) => (
                                            <div key={step.id} className="flex items-center space-x-3">
                                                <div
                                                    className={`w-3 h-3 rounded-full ${index < currentStep
                                                        ? "bg-[var(--chart-2)]"
                                                        : index === currentStep
                                                            ? "bg-[var(--chart-1)]"
                                                            : "bg-[var(--muted)]"
                                                        }`}
                                                />
                                                <span className={`text-sm ${index <= currentStep ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}`}>
                                                    {step.title}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Panel - Form Content */}
                        <div className="w-1/2 bg-[var(--background-secondary)] p-8">
                            <div className="h-full flex flex-col justify-center">{currentStepData.component}</div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
