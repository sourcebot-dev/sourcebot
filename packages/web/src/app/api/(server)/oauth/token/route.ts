import { verifyAndExchangeCode, ACCESS_TOKEN_TTL_SECONDS } from '@/features/oauth/server';
import { apiHandler } from '@/lib/apiHandler';
import { NextRequest } from 'next/server';

// OAuth 2.0 Token Endpoint
// Supports grant_type=authorization_code with PKCE (RFC 7636).
// @see: https://datatracker.ietf.org/doc/html/rfc6749#section-3.2
export const POST = apiHandler(async (request: NextRequest) => {
    const formData = await request.formData();

    const grantType = formData.get('grant_type');
    if (grantType !== 'authorization_code') {
        return Response.json(
            { error: 'unsupported_grant_type', error_description: 'Only authorization_code is supported.' },
            { status: 400 }
        );
    }

    const code = formData.get('code');
    const clientId = formData.get('client_id');
    const redirectUri = formData.get('redirect_uri');
    const codeVerifier = formData.get('code_verifier');

    if (!code || !clientId || !redirectUri || !codeVerifier) {
        return Response.json(
            { error: 'invalid_request', error_description: 'Missing required parameters: code, client_id, redirect_uri, code_verifier.' },
            { status: 400 }
        );
    }

    const result = await verifyAndExchangeCode({
        rawCode: code.toString(),
        clientId: clientId.toString(),
        redirectUri: redirectUri.toString(),
        codeVerifier: codeVerifier.toString(),
    });

    if ('error' in result) {
        return Response.json(
            { error: result.error, error_description: result.errorDescription },
            { status: 400 }
        );
    }

    return Response.json({
        access_token: result.token,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
        scope: '',
    });
});
