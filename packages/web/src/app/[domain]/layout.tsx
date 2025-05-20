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
import { hasEntitlement } from "@/features/entitlements/server";
import { getPublicAccessStatus } from "@/ee/features/publicAccess/publicAccess";

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
            redirect('/login');
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

        if (!membership) {
                const user = await prisma.user.findUnique({
                    where: {
                        id: session.user.id
                    }
                });
                
                if (user?.pendingApproval) {
                    return <PendingApprovalCard domain={domain} />
                } else {
                    return notFound();
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