import { auth as mcpAuth } from '@ai-sdk/mcp';
import { apiHandler } from '@/lib/apiHandler';
import { hasEntitlement, env, createLogger } from '@sourcebot/shared';
import { OAUTH_NOT_SUPPORTED_ERROR_MESSAGE } from '@/ee/features/oauth/constants';
import { PrismaOAuthClientProvider } from '@/features/mcp/prismaOAuthClientProvider';
// Note: We use the raw (unscoped) prisma client here because this route handles OAuth
// redirect callbacks from external providers, so it can't go through withAuthV2. Session
// identity is verified via NextAuth's auth() instead, and all queries filter by userId.
import { prisma } from '@/prisma';
import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { SINGLE_TENANT_ORG_DOMAIN } from '@/lib/constants';

const logger = createLogger('mcp-oauth-callback');

export const GET = apiHandler(async (request: NextRequest) => {
    if (!hasEntitlement('oauth')) {
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
        const domain = SINGLE_TENANT_ORG_DOMAIN;
        const settingsUrl = new URL(`/${domain}/settings/mcpServers`, env.AUTH_URL);
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

    const credential = await prisma.mcpServerCredential.findFirst({
        where: {
            state,
            userId: session.user.id,
        },
        include: {
            server: {
                include: {
                    userMcpServers: {
                        where: { userId: session.user.id },
                        take: 1,
                    },
                },
            },
        },
    });

    if (!credential) {
        return Response.json(
            { error: 'invalid_state', error_description: 'No pending authorization found for this state.' },
            { status: 400 }
        );
    }

    const orgMembership = await prisma.userToOrg.findUnique({
        where: {
            orgId_userId: {
                orgId: credential.server.orgId,
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
        credential.serverId,
        session.user.id,
        `${env.AUTH_URL}/api/ee/askmcp/callback`,
    );

    const result = await mcpAuth(provider, {
        serverUrl: new URL(credential.server.serverUrl),
        authorizationCode: code,
        callbackState: state,
    });

    // Always clear ephemeral PKCE/state regardless of outcome to prevent replay.
    await provider.invalidateCredentials('verifier');

    const domain = SINGLE_TENANT_ORG_DOMAIN;
    const settingsUrl = new URL(`/${domain}/settings/mcpServers`, env.AUTH_URL);

    if (result === 'AUTHORIZED') {
        const displayName = credential.server.userMcpServers[0]?.name ?? credential.server.serverUrl;
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