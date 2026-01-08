import { SourcebotLogo } from "@/app/components/sourcebotLogo";
import { Footer } from "@/app/components/footer";
import { OrgSelector } from "../components/orgSelector";
import { EnterpriseUpgradeCard } from "@/ee/features/billing/components/enterpriseUpgradeCard";
import { TeamUpgradeCard } from "@/ee/features/billing/components/teamUpgradeCard";
import { redirect } from "next/navigation";
import { isServiceError } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeftIcon } from "@radix-ui/react-icons";
import { LogoutEscapeHatch } from "@/app/components/logoutEscapeHatch";
import { env } from "@sourcebot/shared";
import { IS_BILLING_ENABLED } from "@/ee/features/billing/stripe";
import { getSubscriptionInfo } from "@/ee/features/billing/actions";

export default async function Upgrade(props: { params: Promise<{ domain: string }> }) {
    const params = await props.params;

    const {
        domain
    } = params;

    if (!IS_BILLING_ENABLED) {
        redirect(`/${domain}`);
    }

    const subscription = await getSubscriptionInfo(domain);
    if (!subscription) {
        redirect(`/${domain}`);
    }

    if (!isServiceError(subscription) && subscription.status === "active") {
        redirect(`/${domain}`);
    }

    const isTrialing = !isServiceError(subscription) ? subscription.status === "trialing" : false;

    return (
        <div className="flex flex-col items-center pt-12 px-4 sm:px-12 min-h-screen bg-backgroundSecondary relative">
            {isTrialing && (
                <Link href={`/${domain}`} className="text-sm text-muted-foreground mb-5 absolute top-0 left-0 p-4 sm:p-12">
                    <div className="flex flex-row items-center gap-2">
                        <ArrowLeftIcon className="w-4 h-4" /> Return to dashboard
                    </div>
                </Link>
            )}
            <LogoutEscapeHatch className="absolute top-0 right-0 p-4 sm:p-12" />
            <div className="flex flex-col items-center">
                <SourcebotLogo
                    className="h-16 mb-2"
                    size="small"
                />
                <h1 className="text-3xl font-bold mb-3">
                    {isTrialing ?
                        "Upgrade your trial." :
                        "Your subscription has expired."
                    }
                </h1>
                <p className="text-sm text-muted-foreground mb-5">
                    {isTrialing ?
                        "Upgrade now to get the most out of Sourcebot." :
                        "Please upgrade to continue using Sourcebot."
                    }
                </p>
            </div>

            {env.SOURCEBOT_TENANCY_MODE === 'multi' && (
                <OrgSelector
                    domain={domain}
                />
            )}

            <div className="grid gap-8 md:grid-cols-2 max-w-4xl mt-12">
                <TeamUpgradeCard
                    buttonText={isTrialing ? "Upgrade Membership" : "Renew Membership"}
                />
                <EnterpriseUpgradeCard />
            </div>

            <Footer />
        </div>
    )
}