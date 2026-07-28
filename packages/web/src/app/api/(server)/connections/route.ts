'use server';

import { NextRequest } from 'next/server';

import { apiHandler } from '@/lib/apiHandler';
import { buildLinkHeader } from '@/lib/pagination';
import {
    listConnectionsQueryParamsSchema,
} from '@/lib/schemas';
import {
    queryParamsSchemaValidationError,
    serviceErrorResponse,
} from '@/lib/serviceError';
import { isServiceError } from '@/lib/utils';

import { listConnections } from './listConnectionsApi';

// eslint-disable-next-line authz/require-auth-wrapper -- delegates to listConnections() which calls withAuth
export const GET = apiHandler(async (request: NextRequest) => {
    const rawParams = Object.fromEntries(
        Object.keys(listConnectionsQueryParamsSchema.shape).map((key) => [
            key,
            request.nextUrl.searchParams.get(key) ?? undefined,
        ]),
    );
    const parsed = listConnectionsQueryParamsSchema.safeParse(rawParams);

    if (!parsed.success) {
        return serviceErrorResponse(
            queryParamsSchemaValidationError(parsed.error),
        );
    }

    const { page, perPage } = parsed.data;

    const result = await listConnections({ page, perPage });

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    const { data, totalCount } = result;

    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.set('X-Total-Count', totalCount.toString());

    const linkHeader = buildLinkHeader(request, {
        page,
        perPage,
        totalCount,
    });
    if (linkHeader) {
        headers.set('Link', linkHeader);
    }

    return new Response(JSON.stringify({ connections: data }), {
        status: 200,
        headers,
    });
});
