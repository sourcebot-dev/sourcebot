import { searchCommits } from "@/features/search/gitApi";
import { buildLinkHeader, getBaseUrl } from "@/lib/pagination";
import { serviceErrorResponse, queryParamsSchemaValidationError } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";
import { z } from "zod";

const querySchema = z.object({
    repository: z.string(),
    query: z.string().optional(),
    since: z.string().optional(),
    until: z.string().optional(),
    author: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    perPage: z.coerce.number().int().positive().max(100).default(50),
});

export const GET = async (request: NextRequest): Promise<Response> => {
    const parsed = querySchema.safeParse({
        repository: request.nextUrl.searchParams.get('repository') ?? undefined,
        query: request.nextUrl.searchParams.get('query') ?? undefined,
        since: request.nextUrl.searchParams.get('since') ?? undefined,
        until: request.nextUrl.searchParams.get('until') ?? undefined,
        author: request.nextUrl.searchParams.get('author') ?? undefined,
        page: request.nextUrl.searchParams.get('page') ?? undefined,
        perPage: request.nextUrl.searchParams.get('perPage') ?? undefined,
    });

    if (!parsed.success) {
        return serviceErrorResponse(
            queryParamsSchemaValidationError(parsed.error)
        );
    }

    const { page, perPage, ...searchParams } = parsed.data;
    const skip = (page - 1) * perPage;

    const result = await searchCommits({ ...searchParams, maxCount: perPage, skip });

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    const { commits, totalCount } = result;

    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.set('X-Total-Count', totalCount.toString());

    const linkHeader = buildLinkHeader(getBaseUrl(request), {
        page,
        perPage,
        totalCount,
        extraParams: {
            repository: searchParams.repository,
            ...(searchParams.query && { query: searchParams.query }),
            ...(searchParams.since && { since: searchParams.since }),
            ...(searchParams.until && { until: searchParams.until }),
            ...(searchParams.author && { author: searchParams.author }),
        },
    });
    if (linkHeader) headers.set('Link', linkHeader);

    return new Response(JSON.stringify(commits), { status: 200, headers });
}
