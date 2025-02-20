import { prisma } from "@/prisma";
import { PageNotFound } from "./components/pageNotFound";
import { auth } from "@/auth";
import { getOrgFromDomain } from "@/data/org";
import { isServiceError } from "@/lib/utils";
import { OnboardGuard } from "./components/onboardGuard";
import { fetchSubscription } from "@/actions";
import { UpgradeGuard } from "./components/upgradeGuard";

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

    return children;
}