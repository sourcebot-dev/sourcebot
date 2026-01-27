import { NextRequest } from "next/server";
import { z } from "zod";
import { sew } from "@/actions";
import { withOptionalAuthV2 } from "@/withAuthV2";
import { schemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { repositoryQuerySchema } from "@/lib/schemas";
import { buildLinkHeader, getBaseUrl } from "@/lib/pagination";

const querySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    per_page: z.coerce.number().int().positive().max(100).default(30),
    sort: z.enum(['name', 'pushed']).default('name'),
    direction: z.enum(['asc', 'desc']).default('asc'),
    query: z.string().optional(),
});

export const GET = async (request: NextRequest) => {
    const parseResult = querySchema.safeParse({
        page: request.nextUrl.searchParams.get('page') ?? undefined,
        per_page: request.nextUrl.searchParams.get('per_page') ?? undefined,
        sort: request.nextUrl.searchParams.get('sort') ?? undefined,
        direction: request.nextUrl.searchParams.get('direction') ?? undefined,
        query: request.nextUrl.searchParams.get('query') ?? undefined,
    });

    if (!parseResult.success) {
        return serviceErrorResponse(schemaValidationError(parseResult.error));
    }

    const { page, per_page: perPage, sort, direction, query } = parseResult.data;
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
                    where: { orgId: org.id },
                }),
            ]);

            return {
                data: repos.map((repo) => repositoryQuerySchema.parse({
                    codeHostType: repo.external_codeHostType,
                    repoId: repo.id,
                    repoName: repo.name,
                    repoDisplayName: repo.displayName ?? undefined,
                    repoCloneUrl: repo.cloneUrl,
                    webUrl: repo.webUrl ?? undefined,
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

    const linkHeader = buildLinkHeader(getBaseUrl(request), {
        page,
        perPage,
        totalCount,
        extraParams: { sort, direction },
    });
    if (linkHeader) headers.set('Link', linkHeader);

    return new Response(JSON.stringify(data), { status: 200, headers });
};
