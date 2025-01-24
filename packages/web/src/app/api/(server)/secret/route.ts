'user server';

import { secretCreateRequestSchema, secreteDeleteRequestSchema } from "@/lib/schemas";
import { schemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { NextRequest } from "next/server";

export const POST = async (request: NextRequest) => {
    const body = await request.json();
    const parsed = await secretCreateRequestSchema.safeParseAsync(body);
    if (!parsed.success) {
        return serviceErrorResponse(
            schemaValidationError(parsed.error)
        )
    }

    return Response.json({ success: true });
}

export const DELETE = async (request: NextRequest) => {
    const body = await request.json();
    const parsed = await secreteDeleteRequestSchema.safeParseAsync(body);
    if (!parsed.success) {
        return serviceErrorResponse(
            schemaValidationError(parsed.error)
        )
    }

    return Response.json({ success: true });
}