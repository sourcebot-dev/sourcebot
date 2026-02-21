import { sew } from "@/actions";
import { ListReposQueryParams, RepositoryQuery } from "@/lib/types";
import { withOptionalAuthV2 } from "@/withAuthV2";
import { getBrowsePath } from "@/app/[domain]/browse/hooks/utils";
import { env } from "@sourcebot/shared";

export const listRepos = async ({ query, page, perPage, sort, direction }: ListReposQueryParams) => sew(() =>
    withOptionalAuthV2(async ({ org, prisma }) => {
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
                    domain: org.domain,
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