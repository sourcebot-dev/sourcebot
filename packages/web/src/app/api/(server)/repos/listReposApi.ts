import { sew } from "@/middleware/sew";
import { getAuditService } from "@/ee/features/audit/factory";
import { ListReposQueryParams, RepositoryQuery } from "@/lib/types";
import { withOptionalAuth } from "@/middleware/withAuth";
import { getBrowsePath } from "@/app/(app)/browse/hooks/utils";
import { env } from "@sourcebot/shared";
import { headers } from "next/headers";

export const listRepos = async ({ query, page, perPage, sort, direction, source }: ListReposQueryParams & { source?: string }) => sew(() =>
    withOptionalAuth(async ({ org, prisma, user }) => {
        if (user) {
            const resolvedSource = source ?? (await headers()).get('X-Sourcebot-Client-Source') ?? undefined;
            getAuditService().createAudit({
                action: 'user.listed_repos',
                actor: { id: user.id, type: 'user' },
                target: { id: org.id.toString(), type: 'org' },
                orgId: org.id,
                metadata: { source: resolvedSource },
            });
        }

        const skip = (page - 1) * perPage;
        const orderByField = sort === 'pushed' ? 'pushedAt' : 'name';
        const baseUrl = env.AUTH_URL;

        const [repos, totalCount] = await Promise.all([
            prisma.repo.findMany({
                where: {
                    orgId: org.id,
                    ...(query ? {
                        name: { contains: query, mode: 'insensitive' },
                    } : {}),
                },
                skip,
                take: perPage,
                orderBy: { [orderByField]: direction },
            }),
            prisma.repo.count({
                where: {
                    orgId: org.id,
                    ...(query ? {
                        name: { contains: query, mode: 'insensitive' },
                    } : {}),
                },
            }),
        ]);

        return {
            data: repos.map((repo) => ({
                codeHostType: repo.external_codeHostType,
                repoId: repo.id,
                repoName: repo.name,
                webUrl: `${baseUrl}${getBrowsePath({
                    repoName: repo.name,
                    path: '',
                    pathType: 'tree',
                })}`,
                repoDisplayName: repo.displayName ?? undefined,
                externalWebUrl: repo.webUrl ?? undefined,
                imageUrl: repo.imageUrl ?? undefined,
                indexedAt: repo.indexedAt ?? undefined,
                pushedAt: repo.pushedAt ?? undefined,
                defaultBranch: repo.defaultBranch ?? undefined,
                isFork: repo.isFork,
                isArchived: repo.isArchived,
            } satisfies RepositoryQuery)),
            totalCount,
        };
    })
)