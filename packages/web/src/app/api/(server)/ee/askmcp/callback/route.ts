import { auth as mcpAuth } from '@ai-sdk/mcp';
import { apiHandler } from '@/lib/apiHandler';
import { env, createLogger } from '@sourcebot/shared';
import { hasEntitlement } from '@/lib/entitlements';
import { OAUTH_NOT_SUPPORTED_ERROR_MESSAGE } from '@/ee/features/oauth/constants';
import { PrismaOAuthClientProvider } from '@/ee/features/chat/mcp/prismaOAuthClientProvider';
import { getMcpOAuthCallbackUrl } from '@/ee/features/chat/mcp/utils.server';
// Note: We use the raw (unscoped) prisma client here because this route handles OAuth
// redirect callbacks from external providers, so it can't go through withAuth. Session
// identity is verified via NextAuth's auth() instead, and all queries filter by userId.
import { __unsafePrisma as prisma } from '@/prisma';
import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { getExternalMcpErrorLogFields } from '@/ee/features/chat/mcp/externalMcpError';
import { getMcpOAuthReturnToFromState } from '@/ee/features/chat/mcp/mcpOAuthReturnTo';
import { captureEvent } from '@/lib/posthog';
import { getMcpAuthMode, getMcpConnectorEntryPoint, getMcpConnectorFailureReason } from '@/ee/features/chat/mcp/analytics';
import { getEnabledMcpScopeNames } from '@/ee/features/chat/mcp/scopeUtils';

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
    if (!(await hasEntitlement('ask'))) {
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
    const entryPoint = getMcpConnectorEntryPoint(callbackReturnTo);
    const getUserServer = () => {
        if (!state) {
            return Promise.resolve(null);
        }

        return prisma.userMcpServer.findFirst({
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
                        clientInfoSource: true,
                        scopes: {
                            where: { enabled: true },
                            select: { scope: true, enabled: true },
                        },
                    },
                },
            },
        });
    };
    const createEventProperties = (userServer: NonNullable<Awaited<ReturnType<typeof getUserServer>>>) => ({
        source: 'sourcebot-web-client' as const,
        entryPoint,
        serverId: userServer.serverId,
        serverUrl: userServer.server.serverUrl,
        authMode: getMcpAuthMode(userServer.server.clientInfoSource),
    });
    const getEventProperties = async () => {
        const userServer = await getUserServer();
        return userServer ? createEventProperties(userServer) : undefined;
    };

    // Handle OAuth errors (e.g., user cancelled the authorization flow).
    if (oauthError) {
        // Error callbacks often have no authorization code, so fetch the pending connector here
        // only to enrich cancellation/denial analytics when the provider returned state.
        const eventProperties = await getEventProperties();
        if (eventProperties) {
            void captureEvent('ask_mcp_connector_connection_failed', {
                ...eventProperties,
                failureReason: 'oauth_error',
            });
        }
        const url = createMcpOAuthRedirectUrl(callbackReturnTo);
        const errorDescription = searchParams.get('error_description') ?? 'Authorization was cancelled or denied.';
        setMcpOAuthStatusParams(url, { status: 'error', message: errorDescription });
        return NextResponse.redirect(url);
    }

    if (!code || !state) {
        void captureEvent('ask_mcp_connector_connection_failed', {
            source: 'sourcebot-web-client',
            entryPoint,
            failureReason: 'invalid_request',
        });
        return Response.json(
            { error: 'invalid_request', error_description: 'Missing required parameters: code, state.' },
            { status: 400 }
        );
    }

    const userServer = await getUserServer();
    if (!userServer) {
        void captureEvent('ask_mcp_connector_connection_failed', {
            source: 'sourcebot-web-client',
            entryPoint,
            failureReason: 'invalid_state',
        });
        return Response.json(
            { error: 'invalid_state', error_description: 'No pending authorization found for this state.' },
            { status: 400 }
        );
    }

    const connectorEventProperties = createEventProperties(userServer);

    const orgMembership = await prisma.userToOrg.findUnique({
        where: {
            orgId_userId: {
                orgId: userServer.server.orgId,
                userId: session.user.id,
            },
        },
    });

    if (!orgMembership) {
        void captureEvent('ask_mcp_connector_connection_failed', {
            ...connectorEventProperties,
            failureReason: 'forbidden',
        });
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
        callbackUrl: getMcpOAuthCallbackUrl(),
        requestedScopes: getEnabledMcpScopeNames(userServer.server.scopes),
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
        void captureEvent('ask_mcp_connector_connection_failed', {
            ...connectorEventProperties,
            failureReason: getMcpConnectorFailureReason(error),
        });
        return redirectToCallbackError(reconnectMessage, callbackReturnTo);
    } finally {
        // Always clear ephemeral PKCE/state regardless of outcome to prevent replay.
        try {
            await provider.invalidateCredentials('verifier');
        } catch (cleanupError) {
            logger.warn(`Failed to clear MCP OAuth verifier for user ${session.user.id}:`, cleanupError);
        }
    }

    if (result === 'AUTHORIZED') {
        const displayName = userServer.server.name || userServer.server.serverUrl;
        logger.info(`Successfully authorized MCP server ${displayName} for user ${session.user.id}.`);
        void captureEvent('ask_mcp_connector_connection_completed', {
            ...connectorEventProperties,
            alreadyAuthorized: false,
        });
        const url = createMcpOAuthRedirectUrl(callbackReturnTo);
        setMcpOAuthStatusParams(url, { status: 'connected', server: displayName });
        return NextResponse.redirect(url);
    }

    // If auth() didn't return AUTHORIZED, something went wrong
    void captureEvent('ask_mcp_connector_connection_failed', {
        ...connectorEventProperties,
        failureReason: 'token_exchange_failed',
    });
    return redirectToCallbackError('Token exchange failed', callbackReturnTo);
});
