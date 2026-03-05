import { apiHandler } from '@/lib/apiHandler';
import { env } from '@sourcebot/shared';

// RFC 8414: OAuth 2.0 Authorization Server Metadata
// @note: we do not gate on entitlements here. That is handled in the /register,
// /token, and /revoke routes.
// @see: https://datatracker.ietf.org/doc/html/rfc8414
export const GET = apiHandler(async () => {
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
