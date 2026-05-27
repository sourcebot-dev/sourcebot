'use client';

import { ArrowUpCircle } from "lucide-react";
import { useState } from "react";
import { UpsellDialog } from "@/ee/features/lighthouse/upsellDialog";
import { useOffers } from "@/ee/features/lighthouse/useOffers";
import { Skeleton } from "@/components/ui/skeleton";

export const UpgradeButton = () => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const { data: offers, isPending, isError } = useOffers();

    if (isPending) {
        return (
            <Skeleton className="h-6 w-28 mt-1" />
        )
    }

    if (isError) {
        return null;
    }

    const label = offers.trial.eligible ? "Try Pro" : "Upgrade to Pro";
    return (
        <>
            <div className="group-data-[state=collapsed]:hidden px-2 pt-1">
                <button
                    type="button"
                    onClick={() => setIsDialogOpen(true)}
                    className="inline-flex font-semibold items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground text-nowrap transition-colors  bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
                >
                    <ArrowUpCircle className="h-3.5 w-3.5" />
                    {label}
                </button>
            </div>
            <UpsellDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} source="sidebar" />
        </>
    );
}
