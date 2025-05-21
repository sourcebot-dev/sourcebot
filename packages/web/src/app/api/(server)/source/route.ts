'use server';

import { getFileSource } from "@/features/search/fileSourceApi";
import { schemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";
import { fileSourceRequestSchema } from "@/features/search/schemas";
import { ErrorCode } from "@/lib/errorCodes";
import { StatusCodes } from "http-status-codes";

export const POST = async (request: NextRequest) => {
    const domain = request.headers.get("X-Org-Domain");
    const apiKey = request.headers.get("X-Sourcebot-Api-Key") ?? undefined;
    if (!domain) {
        return serviceErrorResponse({
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.MISSING_ORG_DOMAIN_HEADER,
            message: "Missing X-Org-Domain header",
        });
    }

    const body = await request.json();
    const parsed = await fileSourceRequestSchema.safeParseAsync(body);
    if (!parsed.success) {
        return serviceErrorResponse(
            schemaValidationError(parsed.error)
        );
    }
    
    const response = await getFileSource(parsed.data, domain, apiKey);
    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }

    return Response.json(response);
}
