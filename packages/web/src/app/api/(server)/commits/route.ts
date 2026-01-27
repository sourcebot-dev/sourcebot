import { searchCommits } from "@/features/search/gitApi";
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
    maxCount: z.coerce.number().int().positive().max(500).optional(),
});

export const GET = async (request: NextRequest): Promise<Response> => {
    const parsed = querySchema.safeParse({
        repository: request.nextUrl.searchParams.get('repository') ?? undefined,
        query: request.nextUrl.searchParams.get('query') ?? undefined,
        since: request.nextUrl.searchParams.get('since') ?? undefined,
        until: request.nextUrl.searchParams.get('until') ?? undefined,
        author: request.nextUrl.searchParams.get('author') ?? undefined,
        maxCount: request.nextUrl.searchParams.get('maxCount') ?? undefined,
    });

    if (!parsed.success) {
        return serviceErrorResponse(
            queryParamsSchemaValidationError(parsed.error)
        );
    }

    const result = await searchCommits(parsed.data);

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result);
}
