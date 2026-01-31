import { listCommits } from "@/features/git";
import { buildLinkHeader } from "@/lib/pagination";
import { serviceErrorResponse, queryParamsSchemaValidationError } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";
import { z } from "zod";

const listCommitsQueryParamsSchema = z.object({
    repo: z.string(),
    query: z.string().optional(),
    since: z.string().optional(),
    until: z.string().optional(),
    author: z.string().optional(),
    ref: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    perPage: z.coerce.number().int().positive().max(100).default(50),
});

export const GET = async (request: NextRequest): Promise<Response> => {
    const rawParams = Object.fromEntries(
        Object.keys(listCommitsQueryParamsSchema.shape).map(key => [
            key,
            request.nextUrl.searchParams.get(key) ?? undefined
        ])
    );
    const parsed = listCommitsQueryParamsSchema.safeParse(rawParams);

    if (!parsed.success) {
        return serviceErrorResponse(
            queryParamsSchemaValidationError(parsed.error)
        );
    }

    const { page, perPage, ...searchParams } = parsed.data;
    const skip = (page - 1) * perPage;

    const result = await listCommits({ ...searchParams, maxCount: perPage, skip });

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    const { commits, totalCount } = result;

    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.set('X-Total-Count', totalCount.toString());

    const linkHeader = buildLinkHeader(request, {
        page,
        perPage,
        totalCount,
        extraParams: {
            repo: searchParams.repo,
            ...(searchParams.query ? { query: searchParams.query } : {}),
            ...(searchParams.since ? { since: searchParams.since } : {}),
            ...(searchParams.until ? { until: searchParams.until } : {}),
            ...(searchParams.author ? { author: searchParams.author } : {}),
            ...(searchParams.ref ? { ref: searchParams.ref } : {}),
        },
    });
    if (linkHeader) headers.set('Link', linkHeader);

    return new Response(JSON.stringify(commits), { status: 200, headers });
}
