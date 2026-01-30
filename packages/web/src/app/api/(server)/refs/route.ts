'use server';

import { getRefsRequestSchema } from "@/lib/schemas";
import { requestBodySchemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";
import { getRefs } from "./getRefs";

export const POST = async (request: NextRequest) => {
    const body = await request.json();
    const parsed = await getRefsRequestSchema.safeParseAsync(body);
    if (!parsed.success) {
        return serviceErrorResponse(requestBodySchemaValidationError(parsed.error));
    }

    const response = await getRefs(parsed.data);
    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }

    return Response.json(response);
}