'use server';

import { findSearchBasedSymbolReferences } from "@/features/codeNav/actions";
import { ErrorCode } from "@/lib/errorCodes";
import { serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError, requiredQueryParamGuard } from "@/lib/utils";
import { StatusCodes } from "http-status-codes";
import { NextRequest } from "next/server";

export const GET = async (request: NextRequest) => {
    const domain = request.headers.get("X-Org-Domain");
    if (!domain) {
        return serviceErrorResponse({
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.MISSING_ORG_DOMAIN_HEADER,
            message: "Missing X-Org-Domain header",
        });
    }

    const symbolName = requiredQueryParamGuard(request, "symbolName");
    if (isServiceError(symbolName)) return serviceErrorResponse(symbolName);

    const repoName = requiredQueryParamGuard(request, "repoName");
    if (isServiceError(repoName)) return serviceErrorResponse(repoName);

    const language = requiredQueryParamGuard(request, "language");
    if (isServiceError(language)) return serviceErrorResponse(language);

    const references = await findSearchBasedSymbolReferences({
        symbolName,
        repoName,
        language,
    }, domain);
    if (isServiceError(references)) return serviceErrorResponse(references);

    return Response.json(references);
}
