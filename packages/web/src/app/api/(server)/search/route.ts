'use server';

import { search, searchRequestSchema } from "@/features/search";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";
import { schemaValidationError, serviceErrorResponse } from "@/lib/serviceError";

export const POST = async (request: NextRequest) => {
    const body = await request.json();
    const parsed = await searchRequestSchema.safeParseAsync(body);
    if (!parsed.success) {
        return serviceErrorResponse(
            schemaValidationError(parsed.error)
        );
    }

    const {
        query,
        ...options
    } = parsed.data;
    
    const response = await search({
        queryType: 'string',
        query,
        options,
    });

    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }
    return Response.json(response);
}