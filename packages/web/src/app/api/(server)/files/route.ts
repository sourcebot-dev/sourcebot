'use server';

import { getFiles } from "@/features/fileTree/api";
import { getFilesRequestSchema } from "@/features/fileTree/types";
import { requestBodySchemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";

export const POST = async (request: NextRequest) => {
    const body = await request.json();
    const parsed = await getFilesRequestSchema.safeParseAsync(body);
    if (!parsed.success) {
        return serviceErrorResponse(requestBodySchemaValidationError(parsed.error));
    }

    const response = await getFiles(parsed.data);
    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }

    return Response.json(response);
}

