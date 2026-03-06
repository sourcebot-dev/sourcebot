import { apiHandler } from '@/lib/apiHandler';
import { env, hasEntitlement } from '@sourcebot/shared';
import { NextRequest } from 'next/server';
import { OAUTH_NOT_SUPPORTED_ERROR_MESSAGE } from '@/ee/features/oauth/constants';

// RFC 9728: OAuth 2.0 Protected Resource Metadata (path-specific form)
// For a resource at /api/mcp, the well-known URI is /.well-known/oauth-protected-resource/api/mcp.
// @see: https://datatracker.ietf.org/doc/html/rfc9728#section-3
const PROTECTED_RESOURCES = new Set([
    'api/mcp'
]);

export const GET = apiHandler(async (_request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) => {
    if (!hasEntitlement('oauth')) {
        return Response.json(
            { error: 'not_found', error_description: OAUTH_NOT_SUPPORTED_ERROR_MESSAGE },
            { status: 404 }
        );
    }

    const { path } = await params;
    const resourcePath = path.join('/');

    if (!PROTECTED_RESOURCES.has(resourcePath)) {
        return Response.json(
            { error: 'not_found', error_description: `No protected resource metadata found for path: ${resourcePath}` },
            { status: 404 }
        );
    }

    const issuer = env.AUTH_URL.replace(/\/$/, '');

    return Response.json({
        resource: `${issuer}/${resourcePath}`,
        authorization_servers: [
            issuer
        ],
    });
});
