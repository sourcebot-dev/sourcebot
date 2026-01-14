'use server';

import { getTree } from "@/features/fileTree/api";
import { getTreeRequestSchema } from "@/features/fileTree/types";
import { schemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError, measure } from "@/lib/utils";
import { NextRequest } from "next/server";

export const POST = async (request: NextRequest) => {
    const body = await request.json();
    const parsed = await getTreeRequestSchema.safeParseAsync(body);
    if (!parsed.success) {
        return serviceErrorResponse(schemaValidationError(parsed.error));
    }

    const { data: response } = await measure(() => getTree(parsed.data), 'getTree');
    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }

    return Response.json(response);
}

