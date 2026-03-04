import { apiHandler } from '@/lib/apiHandler';
import { requestBodySchemaValidationError, serviceErrorResponse } from '@/lib/serviceError';
import { prisma } from '@/prisma';
import { NextRequest } from 'next/server';
import { z } from 'zod';

// RFC 7591: OAuth 2.0 Dynamic Client Registration
// @see: https://datatracker.ietf.org/doc/html/rfc7591
const registerRequestSchema = z.object({
    client_name: z.string().min(1),
    redirect_uris: z.array(z.string().url()).min(1),
});

export const POST = apiHandler(async (request: NextRequest) => {
    const body = await request.json();
    const parsed = registerRequestSchema.safeParse(body);

    if (!parsed.success) {
        return serviceErrorResponse(requestBodySchemaValidationError(parsed.error));
    }

    const { client_name, redirect_uris } = parsed.data;

    // Reject wildcard redirect URIs per security best practices
    if (redirect_uris.some((uri) => uri.includes('*'))) {
        return Response.json(
            { error: 'invalid_redirect_uri', error_description: 'Wildcard redirect URIs are not allowed.' },
            { status: 400 }
        );
    }

    const client = await prisma.oAuthClient.create({
        data: {
            name: client_name,
            redirectUris: redirect_uris,
        },
    });

    return Response.json(
        {
            client_id: client.id,
            client_name: client.name,
            redirect_uris: client.redirectUris,
        },
        { status: 201 }
    );
});
