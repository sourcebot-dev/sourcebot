"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowUpCircle, BarChart3 } from "lucide-react"
import { UpsellDialog } from "@/ee/features/lighthouse/upsellDialog"
import { useOffers } from "@/ee/features/lighthouse/useOffers"

export function AnalyticsEntitlementMessage() {
    const [isUpsellDialogOpen, setIsUpsellDialogOpen] = useState(false);
    const { data: offers, isPending } = useOffers();

    const buttonLabel = offers?.trial.eligible
        ? `Start ${offers.trial.durationDays} day trial`
        : "Upgrade to Pro";

    return (
        <div className="flex items-center justify-center min-h-[60vh] py-12">
            <Card className="w-full max-w-lg bg-card border-border p-2">
                <CardHeader className="text-center pb-4">
                    <div className="flex justify-center mb-4">
                        <div className="p-3 rounded-full bg-muted">
                            <BarChart3 className="h-8 w-8 text-muted-foreground" />
                        </div>
                    </div>
                    <CardTitle className="text-xl font-semibold text-card-foreground">
                        Analytics is a Pro Feature
                    </CardTitle>
                    <CardDescription className="text-muted-foreground mt-2">
                        Get insights into your organization&apos;s usage patterns and activity. <a href="https://docs.sourcebot.dev/docs/features/analytics" target="_blank" rel="noopener" className="text-primary hover:underline">Learn more</a>
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                    <div className="flex flex-col gap-2">
                        {isPending ? (
                            <Skeleton className="h-9 w-full" />
                        ) : (
                            <Button className="w-full" onClick={() => setIsUpsellDialogOpen(true)}>
                                <ArrowUpCircle className="h-4 w-4 mr-2" />
                                {buttonLabel}
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
            <UpsellDialog
                open={isUpsellDialogOpen}
                onOpenChange={setIsUpsellDialogOpen}
                source="analytics_settings"
                returnPath="/settings/analytics"
            />
        </div>
    )
}