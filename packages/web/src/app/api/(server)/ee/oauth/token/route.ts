import { verifyAndExchangeCode, verifyAndRotateRefreshToken, ACCESS_TOKEN_TTL_SECONDS } from '@/ee/features/oauth/server';
import { apiHandler } from '@/lib/apiHandler';
import { hasEntitlement } from '@sourcebot/shared';
import { NextRequest } from 'next/server';
import { OAUTH_NOT_SUPPORTED_ERROR_MESSAGE } from '@/ee/features/oauth/constants';

// OAuth 2.0 Token Endpoint
// Supports grant_type=authorization_code with PKCE (RFC 7636).
// @see: https://datatracker.ietf.org/doc/html/rfc6749#section-3.2
export const POST = apiHandler(async (request: NextRequest) => {
    if (!hasEntitlement('oauth')) {
        return Response.json(
            { error: 'access_denied', error_description: OAUTH_NOT_SUPPORTED_ERROR_MESSAGE },
            { status: 403 }
        );
    }

    const formData = await request.formData();

    const grantType = formData.get('grant_type');
    const clientId = formData.get('client_id');
    const resource = formData.get('resource');

    if (!clientId) {
        return Response.json(
            { error: 'invalid_request', error_description: 'Missing required parameter: client_id.' },
            { status: 400 }
        );
    }

    if (grantType === 'authorization_code') {
        const code = formData.get('code');
        const redirectUri = formData.get('redirect_uri');
        const codeVerifier = formData.get('code_verifier');

        if (!code || !redirectUri || !codeVerifier) {
            return Response.json(
                { error: 'invalid_request', error_description: 'Missing required parameters: code, redirect_uri, code_verifier.' },
                { status: 400 }
            );
        }

        const result = await verifyAndExchangeCode({
            rawCode: code.toString(),
            clientId: clientId.toString(),
            redirectUri: redirectUri.toString(),
            codeVerifier: codeVerifier.toString(),
            resource: resource ? resource.toString() : null,
        });

        if ('error' in result) {
            return Response.json(
                { error: result.error, error_description: result.errorDescription },
                { status: 400 }
            );
        }

        return Response.json({
            access_token: result.token,
            refresh_token: result.refreshToken,
            token_type: 'Bearer',
            expires_in: ACCESS_TOKEN_TTL_SECONDS,
            scope: '',
        });
    }

    if (grantType === 'refresh_token') {
        const rawRefreshToken = formData.get('refresh_token');

        if (!rawRefreshToken) {
            return Response.json(
                { error: 'invalid_request', error_description: 'Missing required parameter: refresh_token.' },
                { status: 400 }
            );
        }

        const result = await verifyAndRotateRefreshToken({
            rawRefreshToken: rawRefreshToken.toString(),
            clientId: clientId.toString(),
            resource: resource ? resource.toString() : null,
        });

        if ('error' in result) {
            return Response.json(
                { error: result.error, error_description: result.errorDescription },
                { status: 400 }
            );
        }

        return Response.json({
            access_token: result.token,
            refresh_token: result.refreshToken,
            token_type: 'Bearer',
            expires_in: ACCESS_TOKEN_TTL_SECONDS,
            scope: '',
        });
    }

    return Response.json(
        { error: 'unsupported_grant_type', error_description: 'Supported grant types: authorization_code, refresh_token.' },
        { status: 400 }
    );
});
