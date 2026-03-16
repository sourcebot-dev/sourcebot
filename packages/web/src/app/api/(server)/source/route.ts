'use server';

import { getFileSource } from '@/features/git';
import { fileSourceRequestSchema } from '@/features/git/schemas';
import { apiHandler } from "@/lib/apiHandler";
import { queryParamsSchemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";

export const GET = apiHandler(async (request: NextRequest) => {
    const rawParams = Object.fromEntries(
        Object.keys(fileSourceRequestSchema.shape).map(key => [
            key,
            request.nextUrl.searchParams.get(key) ?? undefined
        ])
    );
    const parsed = fileSourceRequestSchema.safeParse(rawParams);

    if (!parsed.success) {
        return serviceErrorResponse(
            queryParamsSchemaValidationError(parsed.error)
        );
    }

    const { repo, path, ref } = parsed.data;
    const response = await getFileSource({
        path,
        repo,
        ref,
    });

    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }

    return Response.json(response);
});
