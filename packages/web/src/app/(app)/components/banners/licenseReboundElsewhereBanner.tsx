import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { OrgRole } from "@sourcebot/db";
import { Button } from "@/components/ui/button";
import { BannerShell } from "./bannerShell";
import type { BannerProps } from "./types";

// @nocheckin: This should instead be a docs page that explains the enterprise offering.
const ENTERPRISE_OFFERING_DOCS_LINK = "https://sourcebot.dev/pricing";

export function LicenseReboundElsewhereBanner({ id, dismissible, role }: BannerProps) {
    const isOwner = role === OrgRole.OWNER;

    const whatsAffectedLink = (
        <a href={ENTERPRISE_OFFERING_DOCS_LINK} target="_blank" rel="noopener noreferrer">
            What&apos;s affected?
        </a>
    );

    const description = isOwner
        ? <>This license is currently activated on a different Sourcebot install, and enterprise features have been disabled here. To use it on this install, deactivate and reactivate the license. {whatsAffectedLink}</>
        : <>This license is currently activated on a different Sourcebot install, and enterprise features have been disabled. Contact your organization administrator to restore access. {whatsAffectedLink}</>;

    return (
        <BannerShell
            id={id}
            dismissible={dismissible}
            icon={<AlertTriangle className="h-4 w-4 mt-0.5 text-destructive" />}
            title="License activated on another instance"
            description={description}
            action={isOwner ? (
                <Button asChild size="sm" variant="outline">
                    <Link href="/settings/license">Manage license</Link>
                </Button>
            ) : undefined}
        />
    );
}
