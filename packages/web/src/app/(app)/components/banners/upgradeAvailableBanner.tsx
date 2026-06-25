import Link from "next/link";
import { CircleArrowUp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BannerShell } from "./bannerShell";
import type { BannerProps } from "./types";

interface UpgradeAvailableBannerProps extends BannerProps {
    currentVersion: string;
    latestVersion: string;
}

export function UpgradeAvailableBanner({ id, dismissible, currentVersion, latestVersion }: UpgradeAvailableBannerProps) {
    return (
        <BannerShell
            id={id}
            dismissible={dismissible}
            icon={<CircleArrowUp className="h-4 w-4 mt-0.5" />}
            title="New Sourcebot version available"
            description={`Update from ${currentVersion} to ${latestVersion}.`}
            action={
                <Button asChild size="sm" variant="outline">
                    <Link
                        href="https://github.com/sourcebot-dev/sourcebot/releases/latest"
                        target="_blank"
                        rel="noreferrer"
                    >
                        Update
                        <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                </Button>
            }
        />
    );
}
