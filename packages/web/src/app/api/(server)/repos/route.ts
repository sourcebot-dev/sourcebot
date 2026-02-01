import { sew } from "@/actions";
import { getBrowsePath } from "@/app/[domain]/browse/hooks/utils";
import { apiHandler } from "@/lib/apiHandler";
import { buildLinkHeader } from "@/lib/pagination";
import { listReposQueryParamsSchema, repositoryQuerySchema } from "@/lib/schemas";
import { queryParamsSchemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { withOptionalAuthV2 } from "@/withAuthV2";
import { NextRequest } from "next/server";

export const GET = apiHandler(async (request: NextRequest) => {
    const rawParams = Object.fromEntries(
        Object.keys(listReposQueryParamsSchema.shape).map(key => [
            key,
            request.nextUrl.searchParams.get(key) ?? undefined
        ])
    );
    const parseResult = listReposQueryParamsSchema.safeParse(rawParams);

    if (!parseResult.success) {
        return serviceErrorResponse(queryParamsSchemaValidationError(parseResult.error));
    }

    const { page, perPage, sort, direction, query } = parseResult.data;
    const skip = (page - 1) * perPage;
    const orderByField = sort === 'pushed' ? 'pushedAt' : 'name';

    const response = await sew(() =>
        withOptionalAuthV2(async ({ org, prisma }) => {
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
                data: repos.map((repo) => repositoryQuerySchema.parse({
                    codeHostType: repo.external_codeHostType,
                    repoId: repo.id,
                    repoName: repo.name,
                    webUrl: `${request.nextUrl.origin}${getBrowsePath({
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
                })),
                totalCount,
            };
        })
    );

    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }

    const { data, totalCount } = response;

    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.set('X-Total-Count', totalCount.toString());

    const linkHeader = buildLinkHeader(request, {
        page,
        perPage,
        totalCount,
        extraParams: {
            sort,
            direction,
            ...(query ? { query } : {}),
        },
    });
    if (linkHeader) headers.set('Link', linkHeader);

    return new Response(JSON.stringify(data), { status: 200, headers });
});
