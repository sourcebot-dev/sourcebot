import Link from "next/link";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BannerShell } from "./bannerShell";
import type { BannerProps } from "./types";

export function InvoicePastDueBanner({ id, dismissible }: BannerProps) {
    return (
        <BannerShell
            id={id}
            dismissible={dismissible}
            icon={<CreditCard className="h-4 w-4 mt-0.5 text-destructive" />}
            title="Payment failed"
            description="Your last invoice hasn't been paid. Update your payment method to avoid losing enterprise access."
            action={
                <Button asChild size="sm" variant="outline">
                    <Link href="/settings/license">Manage license</Link>
                </Button>
            }
        />
    );
}
