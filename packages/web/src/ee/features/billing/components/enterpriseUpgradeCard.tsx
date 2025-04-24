'use client';

import { ENTERPRISE_FEATURES, SOURCEBOT_SUPPORT_EMAIL } from "@/lib/constants";
import { UpgradeCard } from "./upgradeCard";
import Link from "next/link";
import useCaptureEvent from "@/hooks/useCaptureEvent";


export const EnterpriseUpgradeCard = () => {
    const captureEvent = useCaptureEvent();

    const onClick = () => {
        captureEvent('wa_enterprise_upgrade_card_pressed', {});
    }

    return (
        <Link href={`mailto:${SOURCEBOT_SUPPORT_EMAIL}?subject=Enterprise%20Pricing%20Inquiry`}>
            <UpgradeCard
                title="Enterprise"
                description="For large organizations with custom needs."
                price="Custom"
                priceDescription="tailored to your needs"
                features={ENTERPRISE_FEATURES}
                buttonText="Contact Us"
                onClick={onClick}
            />
        </Link>
    )
}