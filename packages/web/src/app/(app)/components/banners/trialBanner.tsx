import Link from "next/link";
import { Clock } from "lucide-react";
import { formatDistance } from "date-fns";
import { Button } from "@/components/ui/button";
import { BannerShell } from "./bannerShell";
import { OpenBillingPortalButton } from "./openBillingPortalButton";
import type { BannerProps } from "./types";

interface TrialBannerProps extends BannerProps {
    // ISO 8601 — serializable across the server component boundary.
    trialEnd: string;
    hasPaymentMethod: boolean;
}

export function TrialBanner({ id, dismissible, now, trialEnd, hasPaymentMethod }: TrialBannerProps) {
    const trialEndDate = new Date(trialEnd);
    const relative = formatDistance(trialEndDate, now, { addSuffix: true });

    const description = hasPaymentMethod
        ? "Your subscription will start automatically at the end of the trial."
        : "Add a payment method to keep enterprise access after your trial ends.";

    return (
        <BannerShell
            id={id}
            dismissible={dismissible}
            icon={<Clock className="h-4 w-4 mt-0.5" />}
            title={`Your trial ends ${relative}`}
            description={description}
            action={hasPaymentMethod ? (
                <Button asChild size="sm" variant="outline">
                    <Link href="/settings/license">Manage subscription</Link>
                </Button>
            ) : (
                <OpenBillingPortalButton label="Add payment method" />
            )}
        />
    );
}
