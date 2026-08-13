import {
    createScopedAccessToken,
    createScopedAccessTokenRequestSchema,
} from '@/ee/features/scopedAccessTokens/api';
import { apiHandler } from '@/lib/apiHandler';
import { requestBodySchemaValidationError, serviceErrorResponse } from '@/lib/serviceError';
import { isServiceError } from '@/lib/utils';
import { StatusCodes } from 'http-status-codes';
import type { NextRequest } from 'next/server';

// eslint-disable-next-line authz/require-auth-wrapper -- delegates to createScopedAccessToken(), which requires API-key authentication
export const POST = apiHandler(async (request: NextRequest) => {
    const parsed = createScopedAccessTokenRequestSchema.safeParse(
        await request.json().catch(() => null),
    );
    if (!parsed.success) {
        return serviceErrorResponse(requestBodySchemaValidationError(parsed.error));
    }

    const result = await createScopedAccessToken(parsed.data);
    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result, { status: StatusCodes.CREATED });
});
