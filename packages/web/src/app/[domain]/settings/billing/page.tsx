import { getCurrentUserRole } from "@/actions"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { getSubscriptionBillingEmail, getSubscriptionInfo } from "@/ee/features/billing/actions"
import { ChangeBillingEmailCard } from "@/ee/features/billing/components/changeBillingEmailCard"
import { ManageSubscriptionButton } from "@/ee/features/billing/components/manageSubscriptionButton"
import { IS_BILLING_ENABLED } from "@/ee/features/billing/stripe"
import { ServiceErrorException } from "@/lib/serviceError"
import { isServiceError } from "@/lib/utils"
import { CalendarIcon, DollarSign, Users } from "lucide-react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

export const metadata: Metadata = {
    title: "Billing | Settings",
    description: "Manage your subscription and billing information",
}

interface BillingPageProps {
    params: {
        domain: string
    }
}

export default async function BillingPage({
    params: { domain },
}: BillingPageProps) {
    if (!IS_BILLING_ENABLED) {
        notFound();
    }

    const subscription = await getSubscriptionInfo(domain)

    if (isServiceError(subscription)) {
        throw new ServiceErrorException(subscription);
    }

    if (!subscription) {
        throw new Error("Subscription not found");
    }

    const currentUserRole = await getCurrentUserRole(domain)
    if (isServiceError(currentUserRole)) {
        throw new ServiceErrorException(currentUserRole);
    }

    const billingEmail = await getSubscriptionBillingEmail(domain);
    if (isServiceError(billingEmail)) {
        throw new ServiceErrorException(billingEmail);
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Billing</h3>
                <p className="text-sm text-muted-foreground">Manage your subscription and billing information</p>
            </div>
            <div className="grid gap-6">
                {/* Billing Email Card */}
                <ChangeBillingEmailCard billingEmail={billingEmail} currentUserRole={currentUserRole} />
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            Subscription Plan
                        </CardTitle>
                        <CardDescription>
                            {subscription.status === "trialing"
                                ? "You are currently on a free trial"
                                : `You are currently on the ${subscription.plan} plan.`}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <Users className="h-5 w-5 text-muted-foreground" />
                                <div className="space-y-1">
                                    <p className="text-sm font-medium leading-none">Seats</p>
                                    <p className="text-sm text-muted-foreground">{subscription.seats} active users</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                                <div className="space-y-1">
                                    <p className="text-sm font-medium leading-none">{subscription.status === "trialing" ? "Trial End Date" : "Next Billing Date"}</p>
                                    <p className="text-sm text-muted-foreground">{new Date(subscription.nextBillingDate * 1000).toLocaleDateString()}</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <DollarSign className="h-5 w-5 text-muted-foreground" />
                                <div className="space-y-1">
                                    <p className="text-sm font-medium leading-none">Billing Amount</p>
                                    <p className="text-sm text-muted-foreground">${(subscription.perSeatPrice * subscription.seats).toFixed(2)} per month</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-2 w-full">
                        <ManageSubscriptionButton currentUserRole={currentUserRole} />
                    </CardFooter>
                </Card>

            </div>
        </div>
    )
}
