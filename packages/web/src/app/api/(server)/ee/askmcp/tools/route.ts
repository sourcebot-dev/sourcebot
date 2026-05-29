import { apiHandler } from '@/lib/apiHandler';
import { serviceErrorResponse } from '@/lib/serviceError';
import { isServiceError } from '@/lib/utils';
import { withAuth } from '@/middleware/withAuth';
import { hasEntitlement } from '@/lib/entitlements';
import { OAUTH_NOT_SUPPORTED_ERROR_MESSAGE } from '@/ee/features/oauth/constants';
import { getMcpToolMetadata } from '@/ee/features/chat/mcp/mcpToolMetadata';
import type { NextRequest } from 'next/server';

export const GET = apiHandler(async (_request: NextRequest) => {
    if (!(await hasEntitlement('oauth'))) {
        return Response.json(
            { error: 'access_denied', error_description: OAUTH_NOT_SUPPORTED_ERROR_MESSAGE },
            { status: 403 },
        );
    }

    const result = await withAuth(async ({ org, user, prisma }) => {
        return getMcpToolMetadata(prisma, user.id, org.id);
    });

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result);
});
