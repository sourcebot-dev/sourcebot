import { listCommits } from "@/features/git";
import { listCommitsQueryParamsSchema } from "@/features/git/schemas";
import { apiHandler } from "@/lib/apiHandler";
import { buildLinkHeader } from "@/lib/pagination";
import { serviceErrorResponse, queryParamsSchemaValidationError } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";

export const GET = apiHandler(async (request: NextRequest): Promise<Response> => {
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
            ...(searchParams.path ? { path: searchParams.path } : {}),
        },
    });
    if (linkHeader) headers.set('Link', linkHeader);

    return new Response(JSON.stringify(commits), { status: 200, headers });
});
