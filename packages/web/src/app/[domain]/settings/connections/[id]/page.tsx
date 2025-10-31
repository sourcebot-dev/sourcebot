import { sew } from "@/actions";
import { BackButton } from "@/app/[domain]/components/backButton";
import { DisplayDate } from "@/app/[domain]/components/DisplayDate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { env } from "@/env.mjs";
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants";
import { notFound, ServiceErrorException } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { withAuthV2 } from "@/withAuthV2";
import { AzureDevOpsConnectionConfig, BitbucketConnectionConfig, GenericGitHostConnectionConfig, GerritConnectionConfig, GiteaConnectionConfig, GithubConnectionConfig, GitlabConnectionConfig } from "@sourcebot/schemas/v3/index.type";
import { getConfigSettings } from "@sourcebot/shared";
import { Info } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ConnectionJobsTable } from "../components/connectionJobsTable";

interface ConnectionDetailPageProps {
    params: Promise<{
        id: string
    }>
}


export default async function ConnectionDetailPage(props: ConnectionDetailPageProps) {
    const params = await props.params;
    const { id } = params;

    const connection = await getConnectionWithJobs(Number.parseInt(id));
    if (isServiceError(connection)) {
        throw new ServiceErrorException(connection);
    }

    const configSettings = await getConfigSettings(env.CONFIG_PATH);

    const nextSyncAttempt = (() => {
        const latestJob = connection.syncJobs.length > 0 ? connection.syncJobs[0] : null;
        if (!latestJob) {
            return undefined;
        }

        if (latestJob.completedAt) {
            return new Date(latestJob.completedAt.getTime() + configSettings.resyncConnectionIntervalMs);
        }

        return undefined;
    })();

    // Extracts the code host URL from the connection config.
    const codeHostUrl: string = (() => {
        const connectionType = connection.connectionType;
        switch (connectionType) {
            case 'github': {
                const config = connection.config as unknown as GithubConnectionConfig;
                return config.url ?? 'https://github.com';
            }
            case 'gitlab': {
                const config = connection.config as unknown as GitlabConnectionConfig;
                return config.url ?? 'https://gitlab.com';
            }
            case 'gitea': {
                const config = connection.config as unknown as GiteaConnectionConfig;
                return config.url ?? 'https://gitea.com';
            }
            case 'gerrit': {
                const config = connection.config as unknown as GerritConnectionConfig;
                return config.url;
            }
            case 'bitbucket': {
                const config = connection.config as unknown as BitbucketConnectionConfig;
                if (config.deploymentType === 'cloud') {
                    return config.url ?? 'https://bitbucket.org';
                } else {
                    return config.url!;
                }
            }
            case 'azuredevops': {
                const config = connection.config as unknown as AzureDevOpsConnectionConfig;
                return config.url ?? 'https://dev.azure.com';
            }
            case 'git': {
                const config = connection.config as unknown as GenericGitHostConnectionConfig;
                return config.url;
            }
        }
    })();

    return (
        <div>
            <BackButton
                href={`/${SINGLE_TENANT_ORG_DOMAIN}/settings/connections`}
                name="Back to connections"
                className="mb-2"
            />
            <div className="flex flex-col gap-2 mb-6">
                <h1 className="text-3xl font-semibold">{connection.name}</h1>

                <Link
                    href={codeHostUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline text-muted-foreground"
                >
                    {codeHostUrl}
                </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-3 mb-8">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                            Created
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>When this connection was first added to Sourcebot</p>
                                </TooltipContent>
                            </Tooltip>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-2xl font-semibold"><DisplayDate date={connection.createdAt} /></span>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                            Last synced
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>The last time this connection was successfully synced</p>
                                </TooltipContent>
                            </Tooltip>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-2xl font-semibold">{connection.syncedAt ? <DisplayDate date={connection.syncedAt} /> : "Never"}</span>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                            Scheduled
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>When the connection will be resynced next. Modifying the config will also trigger a resync.</p>
                                </TooltipContent>
                            </Tooltip>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-2xl font-semibold">{nextSyncAttempt ? <DisplayDate date={nextSyncAttempt} /> : "-"}</span>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Sync History</CardTitle>
                    <CardDescription>History of all sync jobs for this connection.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                        <ConnectionJobsTable data={connection.syncJobs} />
                    </Suspense>
                </CardContent>
            </Card>
        </div>
    )
}

const getConnectionWithJobs = async (id: number) => sew(() =>
    withAuthV2(async ({ prisma, org }) => {
        const connection = await prisma.connection.findUnique({
            where: {
                id,
                orgId: org.id,
            },
            include: {
                syncJobs: {
                    orderBy: {
                        createdAt: 'desc',
                    },
                },
            },
        });

        if (!connection) {
            return notFound();
        }

        return connection;
    })
)