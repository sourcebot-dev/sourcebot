'use server';

import { search } from "@/lib/server/searchService";
import { searchRequestSchema } from "@/lib/schemas";
import { schemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";
import { getCurrentUserOrg } from "../../../../auth";

export const POST = async (request: NextRequest) => {
    const orgId = await getCurrentUserOrg();
    if (isServiceError(orgId)) {
        return serviceErrorResponse(orgId);
    }

    console.log(`Searching for org ${orgId}`);
    const body = await request.json();
    const parsed = await searchRequestSchema.safeParseAsync(body);
    if (!parsed.success) {
        return serviceErrorResponse(
            schemaValidationError(parsed.error)
        );
    }


    const response = await search(parsed.data, orgId);
    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }

    return Response.json(response);
}