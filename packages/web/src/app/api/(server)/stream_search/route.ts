'use server';

import { streamSearch, searchRequestSchema } from '@/features/search';
import { captureEvent } from '@/lib/posthog';
import { schemaValidationError, serviceErrorResponse } from '@/lib/serviceError';
import { isServiceError } from '@/lib/utils';
import { NextRequest } from 'next/server';

export const POST = async (request: NextRequest) => {
    const body = await request.json();
    const parsed = await searchRequestSchema.safeParseAsync(body);

    if (!parsed.success) {
        return serviceErrorResponse(schemaValidationError(parsed.error));
    }

    const {
        query,
        source,
        ...options
    } = parsed.data;

    await captureEvent('api_code_search_request', {
        source: source ?? 'unknown',
        type: 'streamed',
    });

    const stream = await streamSearch({
        queryType: 'string',
        query,
        options,
    });

    if (isServiceError(stream)) {
        return serviceErrorResponse(stream);
    }

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable nginx buffering if applicable
        },
    });
};
