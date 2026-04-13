import { getConnectionStats, getCurrentUserRole, getOrgAccountRequests, getRepos, getReposStats } from "@/actions";
import { SourcebotLogo } from "@/app/components/sourcebotLogo";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { NavigationMenu as NavigationMenuBase } from "@/components/ui/navigation-menu";
import { Separator } from "@/components/ui/separator";
import { ServiceErrorException } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { OrgRole, RepoIndexingJobStatus, RepoIndexingJobType } from "@sourcebot/db";
import Link from "next/link";
import { MeControlDropdownMenu } from "../meControlDropdownMenu";
import WhatsNewIndicator from "../whatsNewIndicator";
import { NavigationItems } from "./navigationItems";
import { ProgressIndicator } from "./progressIndicator";
import { redirect } from "next/navigation";
import { AppearanceDropdownMenu } from "../appearanceDropdownMenu";


export const NavigationMenu = async () => {
    const session = await auth();
    const isAuthenticated = session?.user !== undefined;

    const repoStats = await getReposStats();
    if (isServiceError(repoStats)) {
        throw new ServiceErrorException(repoStats);
    }

    const role = isAuthenticated ? await getCurrentUserRole() : null;
    if (isServiceError(role)) {
        throw new ServiceErrorException(role);
    }

    const stats = await (async () => {
        if (!isAuthenticated || role !== OrgRole.OWNER) {
            return null;
        }

        const joinRequests = await getOrgAccountRequests();
        if (isServiceError(joinRequests)) {
            throw new ServiceErrorException(joinRequests);
        }

        const connectionStats = await getConnectionStats();
        if (isServiceError(connectionStats)) {
            throw new ServiceErrorException(connectionStats);
        }

        return {
            numJoinRequests: joinRequests.length,
            connectionStats,
        };
    })();

    const sampleRepos = await getRepos({
        where: {
            jobs: {
                some: {
                    type: RepoIndexingJobType.INDEX,
                    status: {
                        in: [
                            RepoIndexingJobStatus.PENDING,
                            RepoIndexingJobStatus.IN_PROGRESS,
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
                        href="/"
                        className="mr-3 cursor-pointer"
                    >
                        <SourcebotLogo
                            className="h-11"
                            size="small"
                        />
                    </Link>

                    <NavigationMenuBase>
                        <NavigationItems
                            numberOfRepos={numberOfRepos}
                            isReposButtonNotificationDotVisible={numberOfReposWithFirstTimeIndexingJobsInProgress > 0}
                            isSettingsButtonNotificationDotVisible={
                                stats ? (
                                    stats.connectionStats.numberOfConnectionsWithFirstTimeSyncJobsInProgress > 0 ||
                                    stats.numJoinRequests > 0
                                ) : false
                            }
                            isAuthenticated={isAuthenticated}
                        />
                    </NavigationMenuBase>
                </div>

                <div className="flex flex-row items-center gap-2">
                    <ProgressIndicator
                        numberOfReposWithFirstTimeIndexingJobsInProgress={numberOfReposWithFirstTimeIndexingJobsInProgress}
                        sampleRepos={sampleRepos}
                    />
                    <WhatsNewIndicator />
                    {session ? (
                        <MeControlDropdownMenu
                            session={session}
                        />
                    ) : (
                        <>
                            <form
                                action={async () => {
                                    "use server";
                                    redirect("/login");
                                }}
                            >
                                <Button
                                    variant="outline"
                                    type="submit"
                                >
                                    Sign in
                                </Button>
                            </form>
                            <AppearanceDropdownMenu />
                        </>
                    )}
                </div>
            </div>
            <Separator />
        </div>
    )
}