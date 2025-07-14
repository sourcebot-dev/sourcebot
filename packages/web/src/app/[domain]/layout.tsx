import { prisma } from "@/prisma";
import { auth } from "@/auth";
import { getOrgFromDomain } from "@/data/org";
import { isServiceError } from "@/lib/utils";
import { OnboardGuard } from "./components/onboardGuard";
import { UpgradeGuard } from "./components/upgradeGuard";
import { cookies, headers } from "next/headers";
import { getSelectorsByUserAgent } from "react-device-detect";
import { MobileUnsupportedSplashScreen } from "./components/mobileUnsupportedSplashScreen";
import { MOBILE_UNSUPPORTED_SPLASH_SCREEN_DISMISSED_COOKIE_NAME } from "@/lib/constants";
import { SyntaxReferenceGuide } from "./components/syntaxReferenceGuide";
import { SyntaxGuideProvider } from "./components/syntaxGuideProvider";
import { IS_BILLING_ENABLED } from "@/ee/features/billing/stripe";
import { notFound, redirect } from "next/navigation";
import { getSubscriptionInfo } from "@/ee/features/billing/actions";
import { PendingApprovalCard } from "./components/pendingApproval";
import { SubmitJoinRequest } from "./components/submitJoinRequest";
import { hasEntitlement } from "@sourcebot/shared";
import { getPublicAccessStatus } from "@/ee/features/publicAccess/publicAccess";
import { env } from "@/env.mjs";
import { GcpIapAuth } from "./components/gcpIapAuth";
import { getMemberApprovalRequired } from "@/actions";
import { JoinOrganizationCard } from "@/app/components/joinOrganizationCard";
import { LogoutEscapeHatch } from "@/app/components/logoutEscapeHatch";

interface LayoutProps {
    children: React.ReactNode,
    params: { domain: string }
}

export default async function Layout({
    children,
    params: { domain },
}: LayoutProps) {
    const org = await getOrgFromDomain(domain);

    if (!org) {
        return notFound();
    }

    const publicAccessEnabled = hasEntitlement("public-access") && await getPublicAccessStatus(domain);
    if (!publicAccessEnabled) {
        const session = await auth();
        if (!session) {
            const ssoEntitlement = await hasEntitlement("sso");
            if (ssoEntitlement && env.AUTH_EE_GCP_IAP_ENABLED && env.AUTH_EE_GCP_IAP_AUDIENCE) {
                return <GcpIapAuth callbackUrl={`/${domain}`} />;
            } else {
                redirect('/login');
            }
        }

        const membership = await prisma.userToOrg.findUnique({
            where: {
                orgId_userId: {
                    orgId: org.id,
                    userId: session.user.id
                }
            },
            include: {
                user: true
            }
        });

        // There's two reasons why a user might not be a member of an org:
        // 1. The org doesn't require member approval, but the org was at max capacity when the user registered. In this case, we show them
        // the join organization card to allow them to join the org if seat capacity is freed up. This card handles checking if the org has available seats.
        // 2. The org requires member approval, and they haven't been approved yet. In this case, we allow them to submit a request to join the org.
        if (!membership) {
            const memberApprovalRequired = await getMemberApprovalRequired(domain);
            if (!memberApprovalRequired) {
                return (
                    <div className="min-h-screen flex items-center justify-center p-6">
                        <LogoutEscapeHatch className="absolute top-0 right-0 p-6" />
                        <JoinOrganizationCard />
                    </div>
                )
            } else {
                const hasPendingApproval = await prisma.accountRequest.findFirst({
                    where: {
                        orgId: org.id,
                        requestedById: session.user.id
                    }
                });
                
                if (hasPendingApproval) {
                    return <PendingApprovalCard />
                } else {
                    return <SubmitJoinRequest domain={domain} />
                }
            }
        }
    }

    if (!org.isOnboarded) {
        return (
            <OnboardGuard>
                {children}
            </OnboardGuard>
        )
    }

    if (IS_BILLING_ENABLED) {
        const subscription = await getSubscriptionInfo(domain);
        if (
            subscription &&
            (
                isServiceError(subscription) ||
                (subscription.status !== "active" && subscription.status !== "trialing")
            )
        ) {
            return (
                <UpgradeGuard>
                    {children}
                </UpgradeGuard>
            )
        }
    }

    const headersList = await headers();
    const cookieStore = await cookies()
    const userAgent = headersList.get('user-agent');
    const { isMobile } = getSelectorsByUserAgent(userAgent ?? '');

    if (isMobile && !cookieStore.has(MOBILE_UNSUPPORTED_SPLASH_SCREEN_DISMISSED_COOKIE_NAME)) {
        return (
            <MobileUnsupportedSplashScreen />
        )
    }
    return (
        <SyntaxGuideProvider>
            {children}
            <SyntaxReferenceGuide />
        </SyntaxGuideProvider>
    )
}