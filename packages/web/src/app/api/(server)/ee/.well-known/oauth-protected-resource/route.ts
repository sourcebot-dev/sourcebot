import { apiHandler } from '@/lib/apiHandler';
import { env, hasEntitlement } from '@sourcebot/shared';

// RFC 9728: OAuth 2.0 Protected Resource Metadata
// Tells OAuth clients which authorization server protects this resource.
// @see: https://datatracker.ietf.org/doc/html/rfc9728
export const GET = apiHandler(async () => {
    if (!hasEntitlement('oauth')) {
        return Response.json(
            { error: 'not_found', error_description: 'OAuth protected resource metadata is not available on this plan.' },
            { status: 404 }
        );
    }

    const issuer = env.AUTH_URL.replace(/\/$/, '');

    return Response.json({
        resource: `${issuer}/api/mcp`,
        authorization_servers: [
            issuer
        ],
    });
}, { track: false });
