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

const logger = createLogger('mcp-oauth-callback');

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

    // Handle OAuth errors (e.g., user cancelled the authorization flow).
    if (oauthError) {
        const settingsUrl = new URL(`/settings/mcpServers`, env.AUTH_URL);
        settingsUrl.searchParams.set('status', 'error');
        const errorDescription = searchParams.get('error_description') ?? 'Authorization was cancelled or denied.';
        settingsUrl.searchParams.set('message', errorDescription);
        return NextResponse.redirect(settingsUrl);
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
            name: true,
            server: {
                select: {
                    orgId: true,
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
            { error: 'forbidden', error_description: 'You do not have access to this MCP server.' },
            { status: 403 }
        );
    }

    const provider = new PrismaOAuthClientProvider(
        userServer.serverId,
        session.user.id,
        `${env.AUTH_URL}/api/ee/askmcp/callback`,
    );

    const result = await mcpAuth(provider, {
        serverUrl: new URL(userServer.server.serverUrl),
        authorizationCode: code,
        callbackState: state,
    });

    // Always clear ephemeral PKCE/state regardless of outcome to prevent replay.
    await provider.invalidateCredentials('verifier');

    const settingsUrl = new URL(`/settings/mcpServers`, env.AUTH_URL);

    if (result === 'AUTHORIZED') {
        const displayName = userServer.name || userServer.server.serverUrl;
        logger.info(`Successfully authorized MCP server ${displayName} for user ${session.user.id}.`);
        settingsUrl.searchParams.set('status', 'connected');
        settingsUrl.searchParams.set('server', displayName);
        return NextResponse.redirect(settingsUrl);
    }

    // If auth() didn't return AUTHORIZED, something went wrong
    settingsUrl.searchParams.set('status', 'error');
    settingsUrl.searchParams.set('message', 'Token exchange failed');
    return NextResponse.redirect(settingsUrl);
});
