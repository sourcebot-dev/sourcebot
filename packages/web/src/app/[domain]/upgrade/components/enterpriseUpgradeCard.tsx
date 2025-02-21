'use client';

import { ENTERPRISE_FEATURES } from "@/lib/constants";
import { UpgradeCard } from "./upgradeCard";
import Link from "next/link";


export const EnterpriseUpgradeCard = () => {
    return (
        <Link href="mailto:team@sourcebot.dev?subject=Enterprise%20Pricing%20Inquiry">
            <UpgradeCard
                title="Enterprise"
                description="For large organizations with custom needs."
                price="Custom"
                priceDescription="tailored to your needs"
                features={ENTERPRISE_FEATURES}
                buttonText="Contact Us"
            />
        </Link>
    )
}