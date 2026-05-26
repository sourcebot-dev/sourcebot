import { auth as mcpAuth } from '@ai-sdk/mcp';
import { apiHandler } from '@/lib/apiHandler';
import { env, createLogger } from '@sourcebot/shared';
import { hasEntitlement } from '@/lib/entitlements';
import { OAUTH_NOT_SUPPORTED_ERROR_MESSAGE } from '@/ee/features/oauth/constants';
import { PrismaOAuthClientProvider } from '@/features/mcp/prismaOAuthClientProvider';
// Note: We use the raw (unscoped) prisma client here because this route handles OAuth
// redirect callbacks from external providers, so it can't go through withAuth. Session
// identity is verified via NextAuth's auth() instead, and all queries filter by userId.
import { __unsafePrisma as prisma } from '@/prisma';
import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { getExternalMcpErrorLogFields } from '@/ee/features/mcp/externalMcpError';
import { getMcpOAuthReturnToFromState } from '@/features/mcp/mcpOAuthReturnTo';

const logger = createLogger('mcp-oauth-callback');
const reconnectMessage = 'This connector authorization could not be completed. Please reconnect the connector.';
const defaultMcpOAuthReturnTo = '/settings/accountAskAgent';

function createMcpOAuthRedirectUrl(returnTo: string | undefined): URL {
    return new URL(returnTo ?? defaultMcpOAuthReturnTo, env.AUTH_URL);
}

function setMcpOAuthStatusParams(url: URL, params: { status: 'connected' | 'error'; server?: string; message?: string }) {
    url.searchParams.set('status', params.status);
    if (params.server) {
        url.searchParams.set('server', params.server);
    }
    if (params.message) {
        url.searchParams.set('message', params.message);
    }
}

function redirectToCallbackError(message: string, returnTo?: string) {
    const url = createMcpOAuthRedirectUrl(returnTo);
    setMcpOAuthStatusParams(url, { status: 'error', message });
    return NextResponse.redirect(url);
}

// eslint-disable-next-line authz/require-auth-wrapper -- OAuth redirect callback validates the active session with auth() and filters all queries by userId.
export const GET = apiHandler(async (request: NextRequest) => {
    if (!(await hasEntitlement('oauth'))) {
        return Response.json(
            { error: 'access_denied', error_description: OAUTH_NOT_SUPPORTED_ERROR_MESSAGE },
            { status: 403 }
        );
    }

    const session = await auth();
    if (!session?.user?.id) {
        return Response.json(
            { error: 'unauthorized', error_description: 'You must be logged in.' },
            { status: 401 }
        );
    }

    const { searchParams } = request.nextUrl;
    const oauthError = searchParams.get('error');
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const callbackReturnTo = getMcpOAuthReturnToFromState(state);

    // Handle OAuth errors (e.g., user cancelled the authorization flow).
    if (oauthError) {
        const url = createMcpOAuthRedirectUrl(callbackReturnTo);
        const errorDescription = searchParams.get('error_description') ?? 'Authorization was cancelled or denied.';
        setMcpOAuthStatusParams(url, { status: 'error', message: errorDescription });
        return NextResponse.redirect(url);
    }

    if (!code || !state) {
        return Response.json(
            { error: 'invalid_request', error_description: 'Missing required parameters: code, state.' },
            { status: 400 }
        );
    }

    const userServer = await prisma.userMcpServer.findFirst({
        where: {
            state,
            userId: session.user.id,
        },
        select: {
            serverId: true,
            server: {
                select: {
                    orgId: true,
                    name: true,
                    serverUrl: true,
                },
            },
        },
    });

    if (!userServer) {
        return Response.json(
            { error: 'invalid_state', error_description: 'No pending authorization found for this state.' },
            { status: 400 }
        );
    }

    const orgMembership = await prisma.userToOrg.findUnique({
        where: {
            orgId_userId: {
                orgId: userServer.server.orgId,
                userId: session.user.id,
            },
        },
    });

    if (!orgMembership) {
        return Response.json(
            { error: 'forbidden', error_description: 'You do not have access to this connector.' },
            { status: 403 }
        );
    }

    const provider = new PrismaOAuthClientProvider({
        prisma,
        serverId: userServer.serverId,
        orgId: userServer.server.orgId,
        userId: session.user.id,
        callbackUrl: `${env.AUTH_URL}/api/ee/askmcp/callback`,
    });

    let result: Awaited<ReturnType<typeof mcpAuth>>;

    try {
        result = await mcpAuth(provider, {
            serverUrl: new URL(userServer.server.serverUrl),
            authorizationCode: code,
            callbackState: state,
        });
    } catch (error) {
        logger.warn('Failed to authorize MCP server.', {
            serverId: userServer.serverId,
            orgId: userServer.server.orgId,
            error: getExternalMcpErrorLogFields(error),
        });
        try {
            await provider.invalidateCredentials('verifier');
        } catch (cleanupError) {
            logger.warn(`Failed to clear MCP OAuth verifier for user ${session.user.id}:`, cleanupError);
        }
        return redirectToCallbackError(reconnectMessage, callbackReturnTo);
    }

    // Always clear ephemeral PKCE/state regardless of outcome to prevent replay.
    try {
        await provider.invalidateCredentials('verifier');
    } catch (cleanupError) {
        logger.warn(`Failed to clear MCP OAuth verifier for user ${session.user.id}:`, cleanupError);
    }

    if (result === 'AUTHORIZED') {
        const displayName = userServer.server.name || userServer.server.serverUrl;
        logger.info(`Successfully authorized MCP server ${displayName} for user ${session.user.id}.`);
        const url = createMcpOAuthRedirectUrl(callbackReturnTo);
        setMcpOAuthStatusParams(url, { status: 'connected', server: displayName });
        return NextResponse.redirect(url);
    }

    // If auth() didn't return AUTHORIZED, something went wrong
    return redirectToCallbackError('Token exchange failed', callbackReturnTo);
});
