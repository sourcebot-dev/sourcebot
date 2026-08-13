import { revokeScopedAccessToken } from '@/ee/features/scopedAccessTokens/api';
import { apiHandler } from '@/lib/apiHandler';
import { serviceErrorResponse } from '@/lib/serviceError';
import { isServiceError } from '@/lib/utils';
import { StatusCodes } from 'http-status-codes';
import type { NextRequest } from 'next/server';

// eslint-disable-next-line authz/require-auth-wrapper -- delegates to revokeScopedAccessToken(), which requires API-key authentication
export const DELETE = apiHandler(async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) => {
    const { id } = await params;
    const result = await revokeScopedAccessToken(id);
    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return new Response(null, { status: StatusCodes.NO_CONTENT });
});
