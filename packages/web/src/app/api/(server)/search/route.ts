'use server';

import { search } from "@/features/search/searchApi";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";
import { schemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { searchRequestSchema } from "@/features/search/schemas";

export const POST = async (request: NextRequest) => {
    const body = await request.json();
    const parsed = await searchRequestSchema.safeParseAsync(body);
    if (!parsed.success) {
        return serviceErrorResponse(
            schemaValidationError(parsed.error)
        );
    }
    
    const response = await search(parsed.data);
    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }
    return Response.json(response);
}