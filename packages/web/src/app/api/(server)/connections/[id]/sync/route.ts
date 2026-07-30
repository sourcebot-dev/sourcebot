'use server';

import { NextRequest } from 'next/server';
import { z } from 'zod';

import { triggerConnectionSync } from '@/features/workerApi/actions';
import { apiHandler } from '@/lib/apiHandler';
import { queryParamsSchemaValidationError, serviceErrorResponse } from '@/lib/serviceError';
import { isServiceError } from '@/lib/utils';

const connectionIdParamSchema = z.coerce.number().int().positive();

// eslint-disable-next-line authz/require-auth-wrapper -- delegates to triggerConnectionSync() which calls withAuth + withMinimumOrgRole(OWNER)
export const POST = apiHandler(async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) => {
    const { id: rawId } = await params;
    const idParsed = connectionIdParamSchema.safeParse(rawId);
    if (!idParsed.success) {
        return serviceErrorResponse(queryParamsSchemaValidationError(idParsed.error));
    }
    const id = idParsed.data;

    const result = await triggerConnectionSync(id);

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json({ jobId: result.jobId }, { status: 202 });
});
