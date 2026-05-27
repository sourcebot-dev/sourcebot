import { AlertCircle, CloudOff } from "lucide-react";
import { formatDistance } from "date-fns";
import { OrgRole } from "@sourcebot/db";
import { Button } from "@/components/ui/button";
import { BannerShell } from "./bannerShell";
import { RefreshLicenseButton } from "./refreshLicenseButton";
import type { BannerProps } from "./types";
import { OFFERINGS_DOCS_LINK } from "@/lib/constants";

interface ServicePingFailedBannerProps extends BannerProps {
    variant: 'warning' | 'enforced';
    // ISO 8601, or null if we've never had a successful sync.
    lastSyncAt: string | null;
}

// @nocheckin: link to the service ping docs here when ready.
const SERVICE_PING_DOCS_LINK = "https://docs.sourcebot.dev/docs";

export function ServicePingFailedBanner({
    id,
    dismissible,
    role,
    now,
    variant,
    lastSyncAt,
}: ServicePingFailedBannerProps) {
    const isOwner = role === OrgRole.OWNER;
    const relative = lastSyncAt
        ? formatDistance(new Date(lastSyncAt), now, { addSuffix: true })
        : null;

    const whatsAffectedLink = (
        <a href={OFFERINGS_DOCS_LINK} target="_blank" rel="noopener noreferrer">
            What&apos;s affected?
        </a>
    );

    if (variant === 'warning') {
        return (
            <BannerShell
                id={id}
                dismissible={dismissible}
                icon={<CloudOff className="h-4 w-4 mt-0.5" />}
                title="Can't verify license"
                description={
                    relative
                        ? `Last successful sync with the Sourcebot license server was ${relative}. Paid features will be disabled if this persists.`
                        : "Paid features will be disabled if this persists."
                }
                action={
                    <>
                        <RefreshLicenseButton />
                        <Button asChild size="sm" variant="outline">
                            <a href={SERVICE_PING_DOCS_LINK} target="_blank" rel="noopener noreferrer">
                                Learn more
                            </a>
                        </Button>
                    </>
                }
            />
        );
    }

    const description = (() => {
        if (!isOwner) {
            return <>Sourcebot can&apos;t verify this license right now. Paid features have been disabled. Contact your organization administrator to restore access. {whatsAffectedLink}</>;
        }
        if (relative) {
            return <>Last successful sync with the Sourcebot license server was {relative}. Paid features have been disabled. {whatsAffectedLink}</>;
        }
        return <>Sourcebot has not been able to verify this license and paid features are disabled. {whatsAffectedLink}</>;
    })();

    return (
        <BannerShell
            id={id}
            dismissible={dismissible}
            icon={<AlertCircle className="h-4 w-4 mt-0.5 text-destructive" />}
            title="License could not be verified"
            description={description}
            action={isOwner ? (
                <>
                    <RefreshLicenseButton />
                    <Button asChild size="sm" variant="outline">
                        <a href={SERVICE_PING_DOCS_LINK} target="_blank" rel="noopener noreferrer">
                            Learn more
                        </a>
                    </Button>
                </>
            ) : undefined}
        />
    );
}
