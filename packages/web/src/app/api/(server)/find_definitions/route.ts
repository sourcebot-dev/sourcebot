'use server';

import { findSearchBasedSymbolDefinitions } from "@/features/codeNav/api";
import { findRelatedSymbolsRequestSchema } from "@/features/codeNav/types";
import { apiHandler } from "@/lib/apiHandler";
import { requestBodySchemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";

// eslint-disable-next-line authz/require-auth-wrapper -- delegates to findSearchBasedSymbolDefinitions() which calls withOptionalAuth
export const POST = apiHandler(async (request: NextRequest) => {
    const body = await request.json();
    const parsed = await findRelatedSymbolsRequestSchema.safeParseAsync(body);
    if (!parsed.success) {
        return serviceErrorResponse(requestBodySchemaValidationError(parsed.error));
    }

    const response = await findSearchBasedSymbolDefinitions(parsed.data);
    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }

    return Response.json(response);
});