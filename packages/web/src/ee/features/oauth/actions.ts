'use server';

import { sew } from '@/actions';
import { generateAndStoreAuthCode } from '@/ee/features/oauth/server';
import { withAuthV2 } from '@/withAuthV2';

/**
 * Resolves the final URL to navigate to after an authorization decision.
 * Non-web redirect URIs (e.g. custom schemes like vscode://) are wrapped in
 * /oauth/complete so the browser can handle the handoff.
 */
function resolveCallbackUrl(callbackUrl: URL): string {
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
    withAuthV2(async ({ user }) => {
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
    withAuthV2(async () => {
        const callbackUrl = new URL(redirectUri);
        callbackUrl.searchParams.set('error', 'access_denied');
        callbackUrl.searchParams.set('error_description', 'The user denied the authorization request.');
        if (state) callbackUrl.searchParams.set('state', state);
        return resolveCallbackUrl(callbackUrl);
    }))
