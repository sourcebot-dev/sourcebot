'use server';

import { sew } from "@/middleware/sew";
import { generateAndStoreAuthCode } from '@/ee/features/oauth/server';
import { withAuth } from '@/middleware/withAuth';
import { UNPERMITTED_SCHEMES } from '@/ee/features/oauth/constants';

export interface ConnectedMcpClient {
    id: string;
    name: string;
    logoUri: string | null;
    connectedAt: Date;
    lastUsedAt: Date | null;
}

/**
 * Resolves the final URL to navigate to after an authorization decision.
 * Non-web redirect URIs (e.g. custom schemes like vscode://) are wrapped in
 * /oauth/complete so the browser can handle the handoff.
 */
function resolveCallbackUrl(callbackUrl: URL): string {
    if (UNPERMITTED_SCHEMES.test(callbackUrl.protocol)) {
        throw new Error('Unpermitted redirect URI scheme');
    }

    const isWebUrl = callbackUrl.protocol === 'http:' || callbackUrl.protocol === 'https:';
    return isWebUrl
        ? callbackUrl.toString()
        : `/oauth/complete?url=${encodeURIComponent(callbackUrl.toString())}`;
}

/**
 * Called when the user approves the OAuth authorization request. Generates an
 * authorization code and returns the callback URL for the client to navigate to.
 */
export const approveAuthorization = async ({
    clientId,
    redirectUri,
    codeChallenge,
    resource,
    state,
}: {
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    resource: string | null;
    state: string | undefined;
}) => sew(() =>
    withAuth(async ({ user }) => {
        const rawCode = await generateAndStoreAuthCode({
            clientId,
            userId: user.id,
            redirectUri,
            codeChallenge,
            resource,
        });

        const callbackUrl = new URL(redirectUri);
        callbackUrl.searchParams.set('code', rawCode);
        if (state) callbackUrl.searchParams.set('state', state);
        return resolveCallbackUrl(callbackUrl);
    }))

/**
 * Called when the user denies the OAuth authorization request. Returns the
 * callback URL with an access_denied error for the client to navigate to.
 */
export const denyAuthorization = async ({
    redirectUri,
    state,
}: {
    redirectUri: string;
    state: string | undefined;
}) => sew(() =>
    withAuth(async () => {
        const callbackUrl = new URL(redirectUri);
        callbackUrl.searchParams.set('error', 'access_denied');
        callbackUrl.searchParams.set('error_description', 'The user denied the authorization request.');
        if (state) callbackUrl.searchParams.set('state', state);
        return resolveCallbackUrl(callbackUrl);
    }))

/**
 * Lists the OAuth clients (MCP clients) that the current user has authorized.
 * A client is considered "connected" if it has at least one refresh token for
 * the user — refresh tokens outlive short-lived access tokens, so they're the
 * better signal of an active connection.
 */
export const getConnectedMcpClients = async () => sew(() =>
    withAuth(async ({ user, prisma }) => {
        const clients = await prisma.oAuthClient.findMany({
            where: { refreshTokens: { some: { userId: user.id } } },
            select: {
                id: true,
                name: true,
                logoUri: true,
                refreshTokens: {
                    where: { userId: user.id },
                    select: { createdAt: true },
                    orderBy: { createdAt: 'asc' },
                    take: 1,
                },
                tokens: {
                    where: { userId: user.id },
                    select: { lastUsedAt: true },
                    orderBy: { lastUsedAt: 'desc' },
                    take: 1,
                },
            },
        });

        return clients.map((client) => ({
            id: client.id,
            name: client.name,
            logoUri: client.logoUri,
            connectedAt: client.refreshTokens[0].createdAt,
            lastUsedAt: client.tokens[0]?.lastUsedAt ?? null,
        }));
    }));

/**
 * Revokes all tokens for the given OAuth client / current user pair, fully
 * disconnecting that MCP client from the user's account.
 */
export const revokeMcpClient = async ({ clientId }: { clientId: string }) => sew(() =>
    withAuth(async ({ user, prisma }) => {
        await prisma.$transaction([
            prisma.oAuthToken.deleteMany({ where: { clientId, userId: user.id } }),
            prisma.oAuthRefreshToken.deleteMany({ where: { clientId, userId: user.id } }),
            prisma.oAuthAuthorizationCode.deleteMany({ where: { clientId, userId: user.id } }),
        ]);
        return { success: true };
    }));
