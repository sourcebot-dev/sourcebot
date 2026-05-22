'use client';

import { ArrowUpCircle } from "lucide-react";
import { useState } from "react";
import { UpsellDialog } from "./upsellDialog";
import { useOffers } from "@/ee/features/lighthouse/useOffers";
import { Skeleton } from "@/components/ui/skeleton";

export const UpsellBadge = () => {
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

    const label = offers.trial.eligible ? "Try Enterprise" : "Free plan";
    return (
        <>
            <div className="group-data-[state=collapsed]:hidden px-2 pt-1">
                <button
                    type="button"
                    onClick={() => setIsDialogOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground text-nowrap transition-colors hover:border-foreground hover:text-foreground"
                >
                    <ArrowUpCircle className="h-3.5 w-3.5" />
                    {label}
                </button>
            </div>
            <UpsellDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} offers={offers}/>
        </>
    );
}
