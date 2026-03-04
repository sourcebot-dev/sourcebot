import { revokeToken } from '@/features/oauth/server';
import { apiHandler } from '@/lib/apiHandler';
import { NextRequest } from 'next/server';

// RFC 7009: OAuth 2.0 Token Revocation
// Always returns 200 regardless of whether the token existed.
// @see: https://datatracker.ietf.org/doc/html/rfc7009
export const POST = apiHandler(async (request: NextRequest) => {
    const formData = await request.formData();
    const token = formData.get('token');

    if (token) {
        await revokeToken(token.toString());
    }

    return new Response(null, { status: 200 });
});
