import { apiHandler } from '@/lib/apiHandler';
import { env } from '@sourcebot/shared';

// RFC 8414: OAuth 2.0 Authorization Server Metadata
// @see: https://datatracker.ietf.org/doc/html/rfc8414
export const GET = apiHandler(async () => {
    const issuer = env.AUTH_URL.replace(/\/$/, '');

    return Response.json({
        issuer,
        authorization_endpoint: `${issuer}/oauth/authorize`,
        token_endpoint: `${issuer}/api/oauth/token`,
        registration_endpoint: `${issuer}/api/oauth/register`,
        revocation_endpoint: `${issuer}/api/oauth/revoke`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none'],
    });
}, { track: false });
