'use server';

import { NextRequest } from 'next/server';
import { z } from 'zod';

import { apiHandler } from '@/lib/apiHandler';
import { getConnectionQueryParamsSchema } from '@/lib/schemas';
import {
    notFound,
    queryParamsSchemaValidationError,
    serviceErrorResponse,
} from '@/lib/serviceError';
import { isServiceError } from '@/lib/utils';

import { getConnection } from './getConnectionApi';

const connectionIdParamSchema = z.coerce.number().int().positive();

// eslint-disable-next-line authz/require-auth-wrapper -- delegates to getConnection() which calls withAuth
export const GET = apiHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) => {
    const { id: rawId } = await params;
    const idParsed = connectionIdParamSchema.safeParse(rawId);
    if (!idParsed.success) {
        return serviceErrorResponse(queryParamsSchemaValidationError(idParsed.error));
    }
    const id = idParsed.data;

    const jobLimitRaw = request.nextUrl.searchParams.get('jobLimit') ?? undefined;
    const paramsParsed = getConnectionQueryParamsSchema.safeParse({ jobLimit: jobLimitRaw });
    if (!paramsParsed.success) {
        return serviceErrorResponse(queryParamsSchemaValidationError(paramsParsed.error));
    }
    const { jobLimit } = paramsParsed.data;

    const result = await getConnection({ id, jobLimit });

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    if (result === null || result === undefined) {
        return serviceErrorResponse(notFound());
    }

    return Response.json(result.data, { status: 200 });
});
