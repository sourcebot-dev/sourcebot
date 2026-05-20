import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { OrgRole } from "@sourcebot/db";
import { Button } from "@/components/ui/button";
import { BannerShell } from "./bannerShell";
import type { BannerProps } from "./types";

interface LicenseExpiredBannerProps extends BannerProps {
    source: 'offline' | 'online';
}

// @nocheckin: This should instead be a docs page that explains the enterprise offering.
const ENTERPRISE_OFFERING_DOCS_LINK = "https://sourcebot.dev/pricing";

export function LicenseExpiredBanner({ id, dismissible, role, source }: LicenseExpiredBannerProps) {
    const isOwner = role === OrgRole.OWNER;

    const whatsAffectedLink = (
        <a href={ENTERPRISE_OFFERING_DOCS_LINK} target="_blank" rel="noopener noreferrer">
            What&apos;s affected?
        </a>
    );

    const description = (() => {
        if (source === 'offline') {
            return isOwner
                ? <>Your license has expired and enterprise features are disabled. Update <code className="font-mono text-xs">SOURCEBOT_EE_LICENSE_KEY</code> to restore access. {whatsAffectedLink}</>
                : <>Your license has expired and enterprise features are disabled. Contact your organization administrator to restore access. {whatsAffectedLink}</>;
        }
        return isOwner
            ? <>Your subscription has ended and enterprise features are disabled. Renew to restore access. {whatsAffectedLink}</>
            : <>Your subscription has ended and enterprise features are disabled. Contact your organization administrator to restore access. {whatsAffectedLink}</>;
    })();

    return (
        <BannerShell
            id={id}
            dismissible={dismissible}
            icon={<AlertTriangle className="h-4 w-4 mt-0.5 text-destructive" />}
            title="License expired"
            description={description}
            action={isOwner ? (
                <Button asChild size="sm" variant="outline">
                    <Link href="/settings/license">Manage license</Link>
                </Button>
            ) : undefined}
        />
    );
}
