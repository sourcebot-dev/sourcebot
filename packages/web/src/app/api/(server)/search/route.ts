'use server';

import { search } from "@/lib/server/searchService";
import { searchRequestSchema } from "@/lib/schemas";
import { schemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";

export const POST = async (request: NextRequest) => {
    const body = await request.json();
    const tenantId = await request.headers.get("X-Tenant-ID");

    console.log(`Search request received. Tenant ID: ${tenantId}`);

    const parsed = await searchRequestSchema.safeParseAsync({
        ...body,
        ...(tenantId && { tenantId: parseInt(tenantId) }),
    });
    if (!parsed.success) {
        return serviceErrorResponse(
            schemaValidationError(parsed.error)
        );
    }


    const response = await search(parsed.data);
    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }

    return Response.json(response);
}