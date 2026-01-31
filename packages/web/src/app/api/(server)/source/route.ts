'use server';

import { getFileSource } from '@/features/git';
import { queryParamsSchemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";
import { z } from "zod";

const querySchema = z.object({
    repo: z.string(),
    path: z.string(),
    ref: z.string().optional(),
});

export const GET = async (request: NextRequest) => {
    const rawParams = Object.fromEntries(
        Object.keys(querySchema.shape).map(key => [
            key,
            request.nextUrl.searchParams.get(key) ?? undefined
        ])
    );
    const parsed = querySchema.safeParse(rawParams);

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
}
