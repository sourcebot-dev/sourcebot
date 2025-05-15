'use server';

import { search } from "@/features/search/searchApi";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";
import { schemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { searchRequestSchema } from "@/features/search/schemas";
import { ErrorCode } from "@/lib/errorCodes";
import { StatusCodes } from "http-status-codes";

export const POST = async (request: NextRequest) => {
    const domain = request.headers.get("X-Org-Domain");
    if (!domain) {
        return serviceErrorResponse({
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.MISSING_ORG_DOMAIN_HEADER,
            message: "Missing X-Org-Domain header",
        });
    }

    const body = await request.json();
    const parsed = await searchRequestSchema.safeParseAsync(body);
    if (!parsed.success) {
        return serviceErrorResponse(
            schemaValidationError(parsed.error)
        );
    }
    
    const response = await search(parsed.data, domain);
    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }
    return Response.json(response);
}