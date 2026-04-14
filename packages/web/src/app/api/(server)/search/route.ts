'use server';

import { search, searchRequestSchema } from "@/features/search";
import { apiHandler } from "@/lib/apiHandler";
import { requestBodySchemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";

export const POST = apiHandler(async (request: NextRequest) => {
    const body = await request.json();
    const parsed = await searchRequestSchema.safeParseAsync(body);
    if (!parsed.success) {
        return serviceErrorResponse(
            requestBodySchemaValidationError(parsed.error)
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
});