'use server';

import { fileSourceRequestSchema } from "@/lib/schemas";
import { getFileSource } from "@/lib/server/searchService";
import { schemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";
import { getCurrentUserOrg } from "@/auth";

export const POST = async (request: NextRequest) => {
    const orgId = await getCurrentUserOrg();
    if (isServiceError(orgId)) {
        return orgId;
    }

    const body = await request.json();
    const parsed = await fileSourceRequestSchema.safeParseAsync(body);
    if (!parsed.success) {
        return serviceErrorResponse(
            schemaValidationError(parsed.error)
        );
    }

    const response = await getFileSource(parsed.data, orgId);
    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }

    return Response.json(response);
}
