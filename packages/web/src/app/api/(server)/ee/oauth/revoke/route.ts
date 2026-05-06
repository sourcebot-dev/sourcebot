import { revokeToken } from '@/ee/features/oauth/server';
import { hasEntitlement } from '@/lib/entitlements';
import { oauthApiHandler } from '@/ee/features/oauth/apiHandler';
import { NextRequest } from 'next/server';
import { OAUTH_NOT_SUPPORTED_ERROR_MESSAGE } from '@/ee/features/oauth/constants';

// RFC 7009: OAuth 2.0 Token Revocation
// Always returns 200 regardless of whether the token existed.
// @see: https://datatracker.ietf.org/doc/html/rfc7009
export const POST = oauthApiHandler(async (request: NextRequest) => {
    if (!await hasEntitlement('oauth')) {
        return Response.json(
            { error: 'access_denied', error_description: OAUTH_NOT_SUPPORTED_ERROR_MESSAGE },
            { status: 403 }
        );
    }

    const formData = await request.formData();
    const token = formData.get('token');

    if (token) {
        await revokeToken(token.toString());
    }

    return new Response(null, { status: 200 });
});
