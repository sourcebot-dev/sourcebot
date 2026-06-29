'use server';

import { getFileFreshness } from '@/features/git';
import { fileFreshnessRequestSchema } from '@/features/git/schemas';
import { apiHandler } from "@/lib/apiHandler";
import { queryParamsSchemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";

// eslint-disable-next-line authz/require-auth-wrapper -- delegates to getFileFreshness() which calls withOptionalAuth
export const GET = apiHandler(async (request: NextRequest) => {
    const rawParams = Object.fromEntries(
        Object.keys(fileFreshnessRequestSchema.shape).map(key => [
            key,
            request.nextUrl.searchParams.get(key) ?? undefined
        ])
    );
    const parsed = fileFreshnessRequestSchema.safeParse(rawParams);

    if (!parsed.success) {
        return serviceErrorResponse(
            queryParamsSchemaValidationError(parsed.error)
        );
    }

    const { repo, path, sinceSha } = parsed.data;
    const response = await getFileFreshness({ repo, path, sinceSha });

    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }

    return Response.json(response);
});
