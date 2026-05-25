'use client';

import { useToast } from "@/components/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useEffect } from "react";
import { useLocalStorage } from "usehooks-ts";
import { getVersion } from "@/app/api/(client)/client";
import { useQuery } from "@tanstack/react-query";
import { compareVersions, formatVersion, parseVersion } from "@sourcebot/shared/client";

const GITHUB_TAGS_URL = "https://api.github.com/repos/sourcebot-dev/sourcebot/tags";
const TOAST_TIMEOUT_MS = 1000 * 60 * 60 * 24;

export const UpgradeToast = () => {
    const { toast } = useToast();
    const [ upgradeToastLastShownDate, setUpgradeToastLastShownDate ] = useLocalStorage<string>(
        "upgradeToastLastShownDate",
        new Date(0).toUTCString()
    );

    const { data: versionString } = useQuery({
        queryKey: ["version"],
        queryFn: () => getVersion(),
        select: (data) => data.version,
    })

    useEffect(() => {
        if (!versionString) {
            return;
        }

        const currentVersion = parseVersion(versionString);
        if (!currentVersion) {
            return;
        }

        if (Date.now() - new Date(upgradeToastLastShownDate).getTime() < TOAST_TIMEOUT_MS) {
            return;
        }

        fetch(GITHUB_TAGS_URL)
            .then((response) => response.json())
            .then((data: { name: string }[]) => {
                const versions = data
                    .map(({ name }) => parseVersion(name))
                    .filter((version) => version !== null)
                    .sort((a, b) => compareVersions(a, b))
                    .reverse();

                if (versions.length === 0) {
                    return;
                }

                const latestVersion = versions[0];
                if (compareVersions(currentVersion, latestVersion) >= 0) {
                    return;
                }

                toast({
                    title: "New version available 📣 ",
                    description: `Upgrade from ${formatVersion(currentVersion)} to ${formatVersion(latestVersion)}`,
                    duration: 10 * 1000,
                    action: (
                        <div className="flex flex-col gap-1">
                            <ToastAction
                                altText="Upgrade"
                                onClick={() => {
                                    window.open("https://github.com/sourcebot-dev/sourcebot/releases/latest", "_blank");
                                }}
                            >
                                Upgrade
                            </ToastAction>
                        </div>
                    )
                });

                setUpgradeToastLastShownDate(new Date().toUTCString());
            });
    }, [setUpgradeToastLastShownDate, toast, upgradeToastLastShownDate, versionString]);

    return null;
}

