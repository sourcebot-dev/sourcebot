"use client";

import { useSearchParams } from "next/navigation";
import { LicenseActivactionDialog } from "./licenseActivactionDialog";

// Layout-mounted handler that drives the post-Stripe activation flow regardless
// of which page the user lands on after checkout. Detects `session_id` in the
// URL (set by Stripe's substitution of `{CHECKOUT_SESSION_ID}` in successUrl),
// and renders the claim + activate modal when present.
export function CheckoutReturnHandler() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
        return null;
    }

    return <LicenseActivactionDialog />;
}
