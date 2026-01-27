'use server';

import { getFileSource } from "@/features/search/fileSourceApi";
import { requestBodySchemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";
import { fileSourceRequestSchema } from "@/features/search/types";

export const POST = async (request: NextRequest) => {
    const body = await request.json();
    const parsed = await fileSourceRequestSchema.safeParseAsync(body);
    if (!parsed.success) {
        return serviceErrorResponse(
            requestBodySchemaValidationError(parsed.error)
        );
    }
    
    const response = await getFileSource(parsed.data);
    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }

    return Response.json(response);
}
