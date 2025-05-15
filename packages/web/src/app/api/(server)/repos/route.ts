'use server';

import { listRepositories } from "@/features/search/listReposApi";
import { NextRequest } from "next/server";
import { isServiceError } from "@/lib/utils";
import { serviceErrorResponse } from "@/lib/serviceError";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "@/lib/errorCodes";

export const GET = async (request: NextRequest) => {
    const domain = request.headers.get("X-Org-Domain");
    if (!domain) {
        return serviceErrorResponse({
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.MISSING_ORG_DOMAIN_HEADER,
            message: "Missing X-Org-Domain header",
        });
    }

    const response = await listRepositories(domain);
    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }
    return Response.json(response);
}
