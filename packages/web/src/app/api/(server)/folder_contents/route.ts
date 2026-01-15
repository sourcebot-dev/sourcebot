'use server';

import { getFolderContents } from "@/features/fileTree/api";
import { getFolderContentsRequestSchema } from "@/features/fileTree/types";
import { schemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";

export const POST = async (request: NextRequest) => {
    const body = await request.json();
    const parsed = await getFolderContentsRequestSchema.safeParseAsync(body);
    if (!parsed.success) {
        return serviceErrorResponse(schemaValidationError(parsed.error));
    }

    const response = await getFolderContents(parsed.data);
    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }

    return Response.json(response);
}

