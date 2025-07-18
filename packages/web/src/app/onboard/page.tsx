import type React from "react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AuthMethodSelector } from "@/app/components/authMethodSelector"
import { SourcebotLogo } from "@/app/components/sourcebotLogo"
import { auth } from "@/auth";
import { getAuthProviders } from "@/lib/authProviders";
import { OrganizationAccessSettings } from "@/app/components/organizationAccessSettings";
import { CompleteOnboardingButton } from "./components/completeOnboardingButton";
import { getOrgFromDomain } from "@/data/org";
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants";
import { prisma } from "@/prisma";
import { OrgRole } from "@sourcebot/db";
import { LogoutEscapeHatch } from "@/app/components/logoutEscapeHatch";
import { redirect } from "next/navigation";
import { BetweenHorizontalStart, GitBranchIcon, LockIcon } from "lucide-react";
import { hasEntitlement } from "@sourcebot/shared";
import { getAnonymousAccessStatus } from "@/actions";
import { env } from "@/env.mjs";
import { GcpIapAuth } from "@/app/[domain]/components/gcpIapAuth";
import { headers } from "next/headers";
import { getBaseUrl, createInviteLink, isServiceError } from "@/lib/utils";

interface OnboardingProps {
    searchParams?: { step?: string };
}

interface OnboardingStep {
    id: string
    title: string
    subtitle: React.ReactNode
    component: React.ReactNode
}

interface ResourceCard {
    id: string
    title: string
    description: string
    href: string
    icon?: React.ReactNode
}

export default async function Onboarding({ searchParams }: OnboardingProps) {
    const providers = getAuthProviders();
    const org = await getOrgFromDomain(SINGLE_TENANT_ORG_DOMAIN);
    const session = await auth();

    if (!org) {
        return <div>Error loading organization</div>;
    }

    // Get anonymous access status
    const anonymousAccessEntitlement = hasEntitlement("anonymous-access");
    const anonymousAccessStatus = await getAnonymousAccessStatus(SINGLE_TENANT_ORG_DOMAIN);
    const anonymousAccessEnabled = anonymousAccessEntitlement && !isServiceError(anonymousAccessStatus) && anonymousAccessStatus;

    // Get the current URL to construct the full invite link
    const headersList = headers();
    const baseUrl = getBaseUrl(headersList);
    const inviteLink = createInviteLink(baseUrl, org.inviteLinkId);

    if (org && org.isOnboarded) {
        redirect('/');
    }

    // Check if user is authenticated but not the owner
    if (session?.user) {
        if (org) {
            const membership = await prisma.userToOrg.findUnique({
                where: {
                    orgId_userId: {
                        orgId: org.id,
                        userId: session.user.id
                    }
                }
            });

            if (!membership || membership.role !== OrgRole.OWNER) {
                return <NonOwnerOnboardingMessage />;
            }
        }
    }

    // If we're using an IAP bridge we need to sign them in now and then redirect them back to the onboarding page
    const ssoEntitlement = await hasEntitlement("sso");
    if (ssoEntitlement && env.AUTH_EE_GCP_IAP_ENABLED && env.AUTH_EE_GCP_IAP_AUDIENCE) {
        return <GcpIapAuth callbackUrl={`/onboard`} />;
    }

    // Determine current step based on URL parameter and authentication state
    const stepParam = searchParams?.step ? parseInt(searchParams.step) : 0;
    const currentStep = session?.user ? Math.max(2, stepParam) : Math.max(0, Math.min(stepParam, 1));

    const resourceCards: ResourceCard[] = [
        {
            id: "code-host-connections",
            title: "Code Host Connections",
            description: "Learn how to index repos across Sourcebot's supported platforms",
            href: "https://docs.sourcebot.dev/docs/connections/overview",
            icon: <GitBranchIcon className="w-4 h-4" />,
        },
        {
            id: "authentication-system",
            title: "Authentication System",
            description: "Learn how to setup additional auth providers, invite members, and more",
            href: "https://docs.sourcebot.dev/docs/configuration/auth",
            icon: <LockIcon className="w-4 h-4" />,
        },
        {
            id: "mcp-server",
            title: "MCP Server",
            description: "Learn how to setup Sourcebot's MCP server to provide code context to your AI agents",
            href: "https://docs.sourcebot.dev/docs/features/mcp-server",
            icon: <BetweenHorizontalStart className="w-4 h-4" />,
        }
    ]

    const steps: OnboardingStep[] = [
        {
            id: "welcome",
            title: "Welcome to Sourcebot",
            subtitle: "This onboarding flow will guide you through creating your owner account and configuring your organization.",
            component: (
                <div className="space-y-6">
                    <Button asChild className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200 font-medium">
                        <a href="/onboard?step=1">Get Started →</a>
                    </Button>
                </div>
            ),
        },
        {
            id: "owner-signup",
            title: "Create Owner Account",
            subtitle: (
                <>
                    Use your preferred authentication method to create your owner account. To set up additional authentication providers, check out our{" "}
                    <a
                        href="https://docs.sourcebot.dev/docs/configuration/auth/overview"
                        target="_blank"
                        rel="noopener"
                        className="underline text-[var(--primary)] hover:text-[var(--primary)]/80 transition-colors"
                    >
                        documentation
                    </a>.
                </>
            ),
            component: (
                <div className="space-y-6">
                    <AuthMethodSelector
                        providers={providers}
                        callbackUrl="/onboard"
                        context="signup"
                        securityNoticeClosable={false}
                    />
                </div>
            ),
        },
        {
            id: "configure-org",
            title: "Configure Your Organization",
            subtitle: "Set up your organization's security settings.",
            component: (
                <div className="space-y-6">
                    <OrganizationAccessSettings anonymousAccessEnabled={anonymousAccessEnabled} memberApprovalRequired={org.memberApprovalRequired} inviteLinkEnabled={org.inviteLinkEnabled} inviteLink={inviteLink} />
                    <Button asChild className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200 font-medium">
                        <a href="/onboard?step=3">Continue →</a>
                    </Button>
                </div>
            ),
        },
        {
            id: "complete",
            title: "You're All Set!",
            subtitle: (
                <>
                    Your Sourcebot deployment is ready. Check out these resources to learn how to get the most out of Sourcebot.
                    <div className="text-center space-y-4 mt-6">
                        <div className="w-16 h-16 mx-auto bg-primary rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    </div>
                </>
            ),
            component: (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-3">
                        {resourceCards.map((resourceCard) => (
                            <a
                                key={resourceCard.id}
                                href={resourceCard.href}
                                target="_blank"
                                rel="noopener"
                                className="p-4 rounded-lg bg-accent hover:bg-accent/80 border border-border hover:border-primary/20 transition-all duration-200 group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                    {resourceCard.icon && (
                                        <div className="text-primary">
                                            {resourceCard.icon}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">
                                        {resourceCard.title}
                                    </div>
                                    <div className="text-muted-foreground text-xs mt-1 leading-4">
                                        {resourceCard.description}
                                    </div>
                                </div>
                                <svg className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </div>
                            </a>
                        ))}
                    </div>
                    <CompleteOnboardingButton />
                </div>
            ),
        },
    ]

    const currentStepData = steps[currentStep]

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <div className="w-full max-w-6xl mx-auto">
                <div className="overflow-hidden bg-background">
                    <div className="flex min-h-[700px]">
                        {/* Left Panel - Progress & Branding */}
                        <div className="w-2/5 bg-background p-10 border-r border-border">
                            <div className="h-full flex flex-col">
                                <div className="flex-1">
                                    <div className="mb-16">
                                        <SourcebotLogo
                                            className="w-full h-auto mb-12"
                                            size="large"
                                        />
                                    </div>

                                    {/* Step Progress Indicators */}
                                    <div className="space-y-8">
                                        {steps.map((step, index) => (
                                            <div key={step.id} className="flex items-center group">
                                                <div className="flex items-center space-x-4 flex-1">
                                                                                        <div className="relative">
                                        {/* Connecting line */}
                                        {index < steps.length - 1 && (
                                            <div
                                                className={`absolute top-10 left-1/2 transform -translate-x-1/2 w-0.5 h-8 transition-all duration-300 ${
                                                    index < currentStep ? "bg-primary" : "bg-border"
                                                }`}
                                            />
                                        )}
                                        {/* Circle - positioned above the line with z-index */}
                                        <div
                                            className={`relative z-10 w-10 h-10 rounded-full border-2 flex items-center justify-center font-semibold text-sm transition-all duration-300 ${
                                                index < currentStep
                                                    ? "bg-primary border-primary text-primary-foreground"
                                                    : index === currentStep
                                                        ? "bg-primary border-primary text-primary-foreground scale-110 shadow-lg"
                                                        : "bg-background border-border text-muted-foreground"
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
                                    </div>
                                                    <div className="flex-1">
                                                        <div className={`font-medium text-sm transition-all duration-200 ${
                                                            index <= currentStep ? "text-foreground" : "text-muted-foreground"
                                                        }`}>
                                                            {step.title}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="pt-8 border-t border-border">
                                    <p className="text-xs text-muted-foreground leading-5">
                                        Need help? Check out our{" "}
                                        <a
                                            href="https://docs.sourcebot.dev/docs/overview"
                                            className="text-primary hover:underline font-medium transition-colors"
                                            target="_blank"
                                            rel="noopener"
                                        >
                                            documentation
                                        </a>{" "}
                                        or{" "}
                                        <a
                                            href="https://github.com/sourcebot-dev/sourcebot/discussions"
                                            className="text-primary hover:underline font-medium transition-colors"
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

                        {/* Right Panel - Content */}
                        <div className="w-3/5 bg-background p-10">
                            <div className="h-full flex flex-col justify-center max-w-lg mx-auto">
                                <div className="space-y-8">
                                    {/* Step Header */}
                                    <div className="space-y-6">
                                        <div className="flex items-center space-x-3">
                                            <div className="text-sm font-medium text-muted-foreground">
                                                Step {currentStep + 1} of {steps.length}
                                            </div>
                                            <div className="flex-1 h-px bg-border"></div>
                                        </div>
                                        <div className="space-y-3">
                                            <h1 className="text-3xl font-bold text-foreground leading-tight">
                                                {currentStepData.title}
                                            </h1>
                                            <div className="text-muted-foreground text-base leading-relaxed">
                                                {currentStepData.subtitle}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Step Content */}
                                    <div className="transition-all duration-300 ease-out">
                                        {currentStepData.component}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function NonOwnerOnboardingMessage() {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <LogoutEscapeHatch className="absolute top-0 right-0 p-6" />
            <div className="w-full max-w-md mx-auto">
                <Card className="overflow-hidden shadow-lg border border-border bg-card">
                    <CardContent className="p-8">
                        <div className="text-center space-y-6">
                            <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                                <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>

                            <div className="space-y-3">
                                <h1 className="text-2xl font-semibold text-foreground">
                                    Onboarding In Progress
                                </h1>
                                <p className="text-muted-foreground text-base leading-relaxed">
                                    Your Sourcebot deployment is being configured by the organization owner.
                                </p>
                            </div>

                            <div className="p-4 rounded-lg bg-accent/50 border border-border">
                                <div className="flex items-start gap-3">
                                    <div className="w-5 h-5 mt-0.5 flex-shrink-0">
                                        <svg className="w-full h-full text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-medium text-foreground mb-1">
                                            Owner Access Required
                                        </p>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            Only the organization owner can complete the initial setup and configuration. Once onboarding is complete, you&apos;ll be able to access Sourcebot.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="text-xs text-muted-foreground leading-relaxed">
                                    Need help? Contact your organization owner or check out our{" "}
                                    <a
                                        href="https://docs.sourcebot.dev/docs/overview"
                                        className="text-primary hover:text-primary/80 underline transition-colors"
                                        target="_blank"
                                        rel="noopener"
                                    >
                                        documentation
                                    </a>
                                    .
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
