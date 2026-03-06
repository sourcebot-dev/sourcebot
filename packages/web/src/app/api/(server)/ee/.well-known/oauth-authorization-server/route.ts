import { apiHandler } from '@/lib/apiHandler';
import { env, hasEntitlement } from '@sourcebot/shared';
import { OAUTH_NOT_SUPPORTED_ERROR_MESSAGE } from '@/ee/features/oauth/constants';

// RFC 8414: OAuth 2.0 Authorization Server Metadata
// @see: https://datatracker.ietf.org/doc/html/rfc8414
export const GET = apiHandler(async () => {
    if (!hasEntitlement('oauth')) {
        return Response.json(
            { error: 'not_found', error_description: OAUTH_NOT_SUPPORTED_ERROR_MESSAGE },
            { status: 404 }
        );
    }

    const issuer = env.AUTH_URL.replace(/\/$/, '');

    return Response.json({
        issuer,
        authorization_endpoint: `${issuer}/oauth/authorize`,
        token_endpoint: `${issuer}/api/ee/oauth/token`,
        registration_endpoint: `${issuer}/api/ee/oauth/register`,
        revocation_endpoint: `${issuer}/api/ee/oauth/revoke`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none'],
        service_documentation: 'https://docs.sourcebot.dev',
    });
});
