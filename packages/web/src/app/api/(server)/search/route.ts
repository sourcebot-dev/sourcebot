'use server';

import { search, searchRequestSchema } from "@/features/search";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";
import { requestBodySchemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { captureEvent } from "@/lib/posthog";

export const POST = async (request: NextRequest) => {
    const body = await request.json();
    const parsed = await searchRequestSchema.safeParseAsync(body);
    if (!parsed.success) {
        return serviceErrorResponse(
            requestBodySchemaValidationError(parsed.error)
        );
    }

    const {
        query,
        source,
        ...options
    } = parsed.data;

    await captureEvent('api_code_search_request', {
        source: source ?? 'unknown',
        type: 'blocking',
    });
    
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