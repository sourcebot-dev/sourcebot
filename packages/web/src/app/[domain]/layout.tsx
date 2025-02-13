import { prisma } from "@/prisma";
import { PageNotFound } from "./components/pageNotFound";
import { auth } from "@/auth";
import { getOrgFromDomain } from "@/data/org";
import { fetchSubscription } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { PaywallCard } from "./components/payWall/paywallCard";
import { NavigationMenu } from "./components/navigationMenu";
import { Footer } from "./components/footer";

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

    const subscription = await fetchSubscription(domain);
    if (isServiceError(subscription) || (subscription.status !== "active" && subscription.status !== "trialing")) {
        return (
            <div className="flex flex-col items-center overflow-hidden min-h-screen">
                <NavigationMenu domain={domain} />
                <PaywallCard domain={domain} />
                <Footer />
            </div>
        )
    }

    return children;
}