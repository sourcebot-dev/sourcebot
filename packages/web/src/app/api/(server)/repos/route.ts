import { apiHandler } from "@/lib/apiHandler";
import { buildLinkHeader } from "@/lib/pagination";
import { listReposQueryParamsSchema } from "@/lib/schemas";
import { queryParamsSchemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";
import { listRepos } from "./listReposApi";

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

    const response = await listRepos({
        page,
        perPage,
        sort,
        direction,
        query,
    })

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
