import type { Metadata } from "next"
import { CalendarIcon, DollarSign, Users } from "lucide-react"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ManageSubscriptionButton } from "./manageSubscriptionButton"
import { getSubscriptionData, getCurrentUserRole } from "@/actions"
import { isServiceError } from "@/lib/utils"

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
    const subscription = await getSubscriptionData(domain)

    if (isServiceError(subscription)) {
        return <div>Failed to fetch subscription data. Please contact us at team@sourcebot.dev if this issue persists.</div>
    }

    const currentUserRole = await getCurrentUserRole(domain)
    if (isServiceError(currentUserRole)) {
        return <div>Failed to fetch user role. Please contact us at team@sourcebot.dev if this issue persists.</div>
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Billing</h3>
                <p className="text-sm text-muted-foreground">Manage your subscription and billing information</p>
            </div>
            <Separator />
            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Subscription Plan</CardTitle>
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
