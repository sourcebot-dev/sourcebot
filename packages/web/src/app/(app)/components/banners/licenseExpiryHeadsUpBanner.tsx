import Link from "next/link";
import { Clock } from "lucide-react";
import { formatDistance } from "date-fns";
import { Button } from "@/components/ui/button";
import { BannerShell } from "./bannerShell";
import type { BannerProps } from "./types";

interface LicenseExpiryHeadsUpBannerProps extends BannerProps {
    source: 'offline' | 'online';
    // ISO 8601 — serializable across the server component boundary.
    expiresAt: string;
}

export function LicenseExpiryHeadsUpBanner({ id, dismissible, source, expiresAt, now }: LicenseExpiryHeadsUpBannerProps) {
    const expiresAtDate = new Date(expiresAt);
    const relative = formatDistance(expiresAtDate, now, { addSuffix: true });

    const description = source === 'offline'
        ? <>Update <code className="font-mono text-xs">SOURCEBOT_EE_LICENSE_KEY</code> to keep enterprise access.</>
        : "Renew to keep enterprise access.";

    return (
        <BannerShell
            id={id}
            dismissible={dismissible}
            icon={<Clock className="h-4 w-4 mt-0.5" />}
            title={`License expires ${relative}`}
            description={description}
            action={
                <Button asChild size="sm" variant="outline">
                    <Link href="/settings/license">Manage license</Link>
                </Button>
            }
        />
    );
}
