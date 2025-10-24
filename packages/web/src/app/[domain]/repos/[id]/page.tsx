import { sew } from "@/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants"
import { ServiceErrorException } from "@/lib/serviceError"
import { cn, getCodeHostInfoForRepo, isServiceError } from "@/lib/utils"
import { withOptionalAuthV2 } from "@/withAuthV2"
import { ChevronLeft, ExternalLink, Info } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { RepoJobsTable } from "../components/repoJobsTable"
import { getConfigSettings } from "@sourcebot/shared"
import { env } from "@/env.mjs"
import { DisplayDate } from "../../components/DisplayDate"

export default async function RepoDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const repo = await getRepoWithJobs(Number.parseInt(id))
    if (isServiceError(repo)) {
        throw new ServiceErrorException(repo);
    }

    const codeHostInfo = getCodeHostInfoForRepo({
        codeHostType: repo.external_codeHostType,
        name: repo.name,
        displayName: repo.displayName ?? undefined,
        webUrl: repo.webUrl ?? undefined,
    });

    const configSettings = await getConfigSettings(env.CONFIG_PATH);

    const nextIndexAttempt = (() => {
        const latestJob = repo.jobs.length > 0 ? repo.jobs[0] : null;
        if (!latestJob) {
            return undefined;
        }

        if (latestJob.completedAt) {
            return new Date(latestJob.completedAt.getTime() + configSettings.reindexIntervalMs);
        }

        return undefined;
    })();

    return (
        <div className="container mx-auto">
            <div className="mb-6">
                <Button variant="ghost" asChild className="mb-4">
                    <Link href={`/${SINGLE_TENANT_ORG_DOMAIN}/repos`}>
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to repositories
                    </Link>
                </Button>

                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-semibold">{repo.displayName || repo.name}</h1>
                        <p className="text-muted-foreground mt-2">{repo.name}</p>
                    </div>
                    {(codeHostInfo && codeHostInfo.repoLink) && (
                        <Button variant="outline" asChild>
                            <Link href={codeHostInfo.repoLink} target="_blank" rel="noopener noreferrer" className="flex items-center">
                                <Image
                                    src={codeHostInfo.icon}
                                    alt={codeHostInfo.codeHostName}
                                    className={cn("w-4 h-4 flex-shrink-0", codeHostInfo.iconClassName)}
                                />
                                Open in {codeHostInfo.codeHostName}
                                <ExternalLink className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    )}
                </div>

                <div className="flex gap-2 mt-4">
                    {repo.isArchived && <Badge variant="secondary">Archived</Badge>}
                    {repo.isPublic && <Badge variant="outline">Public</Badge>}
                </div>
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
                                    <p>When this repository was first added to Sourcebot</p>
                                </TooltipContent>
                            </Tooltip>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DisplayDate date={repo.createdAt} className="text-2xl font-semibold"/>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                            Last indexed
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>The last time this repository was successfully indexed</p>
                                </TooltipContent>
                            </Tooltip>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {repo.indexedAt ? <DisplayDate date={repo.indexedAt} className="text-2xl font-semibold"/> : "Never" }
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
                                    <p>When the next indexing job is scheduled to run</p>
                                </TooltipContent>
                            </Tooltip>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {nextIndexAttempt ? <DisplayDate date={nextIndexAttempt} className="text-2xl font-semibold"/> : "-" }
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Indexing Jobs</CardTitle>
                    <CardDescription>History of all indexing and cleanup jobs for this repository</CardDescription>
                </CardHeader>
                <CardContent>
                    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                        <RepoJobsTable data={repo.jobs} />
                    </Suspense>
                </CardContent>
            </Card>
        </div>
    )
}

const getRepoWithJobs = async (repoId: number) => sew(() =>
    withOptionalAuthV2(async ({ prisma }) => {

        const repo = await prisma.repo.findUnique({
            where: {
                id: repoId,
            },
            include: {
                jobs: {
                    orderBy: {
                        createdAt: 'desc'
                    },
                }
            },
        });

        if (!repo) {
            return notFound();
        }

        return repo;
    })
);