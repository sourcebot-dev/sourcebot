import { Suspense } from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { RepoJobsTable } from "../components/repo-jobs-table"
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants"
import { sew } from "@/actions"
import { withOptionalAuthV2 } from "@/withAuthV2"
import { ServiceErrorException } from "@/lib/serviceError"
import { cn, getCodeHostInfoForRepo, isServiceError } from "@/lib/utils"
import Image from "next/image"

function formatDate(date: Date | null) {
    if (!date) return "Never"
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date)
}

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

    return (
        <div className="container mx-auto py-10">
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
                        <CardTitle className="text-sm font-medium">Last Indexed</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold">{repo.indexedAt ? formatDate(repo.indexedAt) : "Never"}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Created</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold">{formatDate(repo.createdAt)}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-semibold">{formatDate(repo.updatedAt)}</div>
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
                jobs: true,
            }
        });

        if (!repo) {
            return notFound();
        }

        return repo;
    })
);