import { getRepos, getReposStats } from "@/actions";
import { SourcebotLogo } from "@/app/components/sourcebotLogo";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { NavigationMenu as NavigationMenuBase } from "@/components/ui/navigation-menu";
import { Separator } from "@/components/ui/separator";
import { getSubscriptionInfo } from "@/ee/features/billing/actions";
import { IS_BILLING_ENABLED } from "@/ee/features/billing/stripe";
import { env } from "@/env.mjs";
import { ServiceErrorException } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { DiscordLogoIcon, GitHubLogoIcon } from "@radix-ui/react-icons";
import { RepoJobStatus, RepoJobType } from "@sourcebot/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OrgSelector } from "../orgSelector";
import { SettingsDropdown } from "../settingsDropdown";
import WhatsNewIndicator from "../whatsNewIndicator";
import { NavigationItems } from "./navigationItems";
import { ProgressIndicator } from "./progressIndicator";
import { TrialIndicator } from "./trialIndicator";

const SOURCEBOT_DISCORD_URL = "https://discord.gg/6Fhp27x7Pb";
const SOURCEBOT_GITHUB_URL = "https://github.com/sourcebot-dev/sourcebot";

interface NavigationMenuProps {
    domain: string;
}

export const NavigationMenu = async ({
    domain,
}: NavigationMenuProps) => {
    const subscription = IS_BILLING_ENABLED ? await getSubscriptionInfo(domain) : null;
    const session = await auth();
    const isAuthenticated = session?.user !== undefined;

    const repoStats = await getReposStats();
    if (isServiceError(repoStats)) {
        throw new ServiceErrorException(repoStats);
    }

    const sampleRepos = await getRepos({
        where: {
            jobs: {
                some: {
                    type: RepoJobType.INDEX,
                    status: {
                        in: [
                            RepoJobStatus.PENDING,
                            RepoJobStatus.IN_PROGRESS,
                        ]
                    }
                },
            },
            indexedAt: null,
        },
        take: 5,
    });

    if (isServiceError(sampleRepos)) {
        throw new ServiceErrorException(sampleRepos);
    }

    const {
        numberOfRepos,
        numberOfReposWithFirstTimeIndexingJobsInProgress,
    } = repoStats;

    return (
        <div className="flex flex-col w-full h-fit bg-background">
            <div className="flex flex-row justify-between items-center py-0.5 px-3">
                <div className="flex flex-row items-center">
                    <Link
                        href={`/${domain}`}
                        className="mr-3 cursor-pointer"
                    >
                        <SourcebotLogo
                            className="h-11"
                            size="small"
                        />
                    </Link>

                    {env.SOURCEBOT_TENANCY_MODE === 'multi' && (
                        <>
                            <OrgSelector
                                domain={domain}
                            />
                            <Separator orientation="vertical" className="h-6 mx-2" />
                        </>
                    )}

                    <NavigationMenuBase>
                        <NavigationItems
                            domain={domain}
                            numberOfRepos={numberOfRepos}
                            numberOfReposWithFirstTimeIndexingJobsInProgress={numberOfReposWithFirstTimeIndexingJobsInProgress}
                            isAuthenticated={isAuthenticated}
                        />
                    </NavigationMenuBase>
                </div>

                <div className="flex flex-row items-center gap-2">
                    <ProgressIndicator
                        numberOfReposWithFirstTimeIndexingJobsInProgress={numberOfReposWithFirstTimeIndexingJobsInProgress}
                        sampleRepos={sampleRepos}
                    />
                    <TrialIndicator subscription={subscription} />
                    <WhatsNewIndicator />
                    <form
                        action={async () => {
                            "use server";
                            redirect(SOURCEBOT_DISCORD_URL);
                        }}
                    >
                        <Button
                            variant="outline"
                            size="icon"
                            type="submit"
                        >
                            <DiscordLogoIcon className="w-4 h-4" />
                        </Button>
                    </form>
                    <form
                        action={async () => {
                            "use server";
                            redirect(SOURCEBOT_GITHUB_URL);
                        }}
                    >
                        <Button
                            variant="outline"
                            size="icon"
                            type="submit"
                        >
                            <GitHubLogoIcon className="w-4 h-4" />
                        </Button>
                    </form>
                    <SettingsDropdown />
                </div>
            </div>
            <Separator />
        </div>
    )
}