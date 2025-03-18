import { prisma } from "@/prisma";
import { PageNotFound } from "./components/pageNotFound";
import { auth } from "@/auth";
import { getOrgFromDomain } from "@/data/org";
import { isServiceError } from "@/lib/utils";
import { OnboardGuard } from "./components/onboardGuard";
import { fetchSubscription } from "@/actions";
import { UpgradeGuard } from "./components/upgradeGuard";
import { cookies, headers } from "next/headers";
import { getSelectorsByUserAgent } from "react-device-detect";
import { MobileUnsupportedSplashScreen } from "./components/mobileUnsupportedSplashScreen";
import { MOBILE_UNSUPPORTED_SPLASH_SCREEN_DISMISSED_COOKIE_NAME } from "@/lib/constants";
import { SyntaxReferenceGuide } from "./components/syntaxReferenceGuide";
import { SyntaxGuideProvider } from "./components/syntaxGuideProvider";
import { IS_BILLING_ENABLED } from "@/lib/stripe";

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
        return <PageNotFound />
    }


    const session = await auth();
    if (!session) {
        return <PageNotFound />
    }


    const membership = await prisma.userToOrg.findUnique({
        where: {
            orgId_userId: {
                orgId: org.id,
                userId: session.user.id
            }
        }
    });

    if (!membership) {
        return <PageNotFound />
    }

    if (!org.isOnboarded) {
        return (
            <OnboardGuard>
                {children}
            </OnboardGuard>
        )
    }

    if (IS_BILLING_ENABLED) {
        const subscription = await fetchSubscription(domain);
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