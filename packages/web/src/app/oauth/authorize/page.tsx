import { auth } from '@/auth';
import { LogoutEscapeHatch } from '@/app/components/logoutEscapeHatch';
import { ConsentScreen } from './components/consentScreen';
import { __unsafePrisma } from '@/prisma';
import { hasEntitlement } from '@/lib/entitlements';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface AuthorizePageProps {
    searchParams: Promise<{
        client_id?: string;
        redirect_uri?: string;
        code_challenge?: string;
        code_challenge_method?: string;
        response_type?: string;
        state?: string;
        resource?: string | string[];
    }>;
}

export default async function AuthorizePage({ searchParams }: AuthorizePageProps) {
    if (!await hasEntitlement('oauth')) {
        return <ErrorPage message="OAuth authorization is not available on this plan." />;
    }

    const params = await searchParams;
    const { client_id, redirect_uri, code_challenge, code_challenge_method, response_type, state, resource: _resource } = params;

    // RFC 8707 allows multiple resource parameters to indicate a token intended for multiple resources.
    // Sourcebot only supports a single resource (the MCP endpoint), so we take the first value.
    //
    // @see: https://www.rfc-editor.org/rfc/rfc8707.html#section-2-2.2
    const resource = Array.isArray(_resource) ? _resource[0] : _resource;

    // Validate required parameters. Per spec, do NOT redirect on client errors —
    // show an error page instead to avoid open redirect vulnerabilities.
    if (!client_id || !redirect_uri || !code_challenge || !response_type) {
        return <ErrorPage message="Missing required OAuth parameters." />;
    }

    if (response_type !== 'code') {
        return <ErrorPage message={`Unsupported response_type: ${response_type}. Only "code" is supported.`} />;
    }

    if (code_challenge_method && code_challenge_method !== 'S256') {
        return <ErrorPage message={`Unsupported code_challenge_method: ${code_challenge_method}. Only "S256" is supported.`} />;
    }

    const client = await __unsafePrisma.oAuthClient.findUnique({ where: { id: client_id } });

    if (!client) {
        return <ErrorPage message="Unknown client_id. The application has not been registered." />;
    }

    if (!client.redirectUris.includes(redirect_uri)) {
        return <ErrorPage message="redirect_uri does not match the registered redirect URIs for this client." />;
    }

    // If the user is not logged in, redirect to login with this page as the callback.
    const session = await auth();
    if (!session) {
        const callbackUrl = `/oauth/authorize?${new URLSearchParams(params as Record<string, string>).toString()}`;
        redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }

    return (
        <div className="relative min-h-screen flex items-center justify-center bg-background">
            <LogoutEscapeHatch className="absolute top-0 right-0 p-6" />
            <ConsentScreen
                clientId={client_id!}
                clientName={client.name}
                clientLogoUri={client.logoUri}
                redirectUri={redirect_uri!}
                codeChallenge={code_challenge!}
                resource={resource ?? null}
                state={state}
                userEmail={session!.user.email!}
            />
        </div>
    );
}

function ErrorPage({ message }: { message: string }) {
    return (
        <div className="relative min-h-screen flex items-center justify-center bg-background">
            <LogoutEscapeHatch className="absolute top-0 right-0 p-6" />
            <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm text-center">
                <h1 className="text-xl font-semibold text-foreground mb-2">Authorization Error</h1>
                <p className="text-sm text-muted-foreground">{message}</p>
            </div>
        </div>
    );
}
