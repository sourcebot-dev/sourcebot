'use server';

import { minidenticon } from 'minidenticons';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/apiHandler';
import { queryParamsSchemaValidationError, serviceErrorResponse } from '@/lib/serviceError';
import { isServiceError } from '@/lib/utils';
import { withOptionalAuth } from '@/middleware/withAuth';

const queryParamsSchema = z.object({
    email: z.string().min(1),
});

// Resolves an email to an avatar image. If the email belongs to a Sourcebot
// user in the requester's org and that user has a profile image set, the
// request is redirected to that URL. Otherwise a minidenticon SVG is returned.
//
// We never 4xx on this endpoint — even if the requester is unauthenticated or
// the user isn't found, we serve the identicon so the avatar visually renders.
export const GET = apiHandler(async (request: NextRequest) => {
    const rawParams = Object.fromEntries(
        Object.keys(queryParamsSchema.shape).map(key => [
            key,
            request.nextUrl.searchParams.get(key) ?? undefined,
        ])
    );
    const parsed = queryParamsSchema.safeParse(rawParams);

    if (!parsed.success) {
        return serviceErrorResponse(
            queryParamsSchemaValidationError(parsed.error)
        );
    }

    const { email } = parsed.data;

    const lookup = await withOptionalAuth(async ({ org, prisma }) => {
        return prisma.user.findFirst({
            where: {
                email,
                orgs: { some: { orgId: org.id } },
            },
            select: { image: true },
        });
    });

    if (!isServiceError(lookup) && lookup?.image) {
        return new Response(null, {
            status: 302,
            headers: {
                'Location': lookup.image,
                'Cache-Control': 'public, max-age=300',
            },
        });
    }

    // Fallback: identicons are deterministic from the email so they can be
    // cached aggressively.
    const svg = minidenticon(email, 50, 50);
    return new Response(svg, {
        status: 200,
        headers: {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'public, max-age=31536000, immutable',
        },
    });
}, { track: false });
