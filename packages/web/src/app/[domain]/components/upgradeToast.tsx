'use client';

import { useToast } from "@/components/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useEffect } from "react";
import { useLocalStorage } from "usehooks-ts";
import { getVersion } from "@/app/api/(client)/client";
import { useQuery } from "@tanstack/react-query";

const GITHUB_TAGS_URL = "https://api.github.com/repos/sourcebot-dev/sourcebot/tags";
const SEMVER_REGEX = /^v(\d+)\.(\d+)\.(\d+)$/;
const TOAST_TIMEOUT_MS = 1000 * 60 * 60 * 24;

type Version = {
    major: number;
    minor: number;
    patch: number;
};

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

        const currentVersion = getVersionFromString(versionString);
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
                    .map(({ name }) => getVersionFromString(name))
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
                    description: `Upgrade from ${getVersionString(currentVersion)} to ${getVersionString(latestVersion)}`,
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

const getVersionFromString = (version: string): Version | null => {
    const match = version.match(SEMVER_REGEX);
    if (!match) {
        return null;
    }
    return {
        major: parseInt(match[1]),
        minor: parseInt(match[2]),
        patch: parseInt(match[3]),
    } satisfies Version;
}

const getVersionString = (version: Version) => {
    return `v${version.major}.${version.minor}.${version.patch}`;
}

const compareVersions = (a: Version, b: Version) => {
    if (a.major !== b.major) {
        return a.major - b.major;
    }
    if (a.minor !== b.minor) {
        return a.minor - b.minor;
    }
    return a.patch - b.patch;
}
