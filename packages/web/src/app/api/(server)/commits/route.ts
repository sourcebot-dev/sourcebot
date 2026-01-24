import { searchCommits } from "@/features/search/gitApi";
import { serviceErrorResponse, schemaValidationError } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";
import { searchCommitsRequestSchema } from "@/features/search/types";

export async function POST(request: NextRequest): Promise<Response> {
    const body = await request.json();
    const parsed = await searchCommitsRequestSchema.safeParseAsync(body);

    if (!parsed.success) {
        return serviceErrorResponse(
            schemaValidationError(parsed.error)
        );
    }

    const result = await searchCommits(parsed.data);

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result);
}
