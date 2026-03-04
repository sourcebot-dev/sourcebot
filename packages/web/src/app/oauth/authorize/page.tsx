import { auth } from '@/auth';
import { generateAndStoreAuthCode } from '@/features/oauth/server';
import { prisma } from '@/prisma';
import { redirect } from 'next/navigation';

interface AuthorizePageProps {
    searchParams: Promise<{
        client_id?: string;
        redirect_uri?: string;
        code_challenge?: string;
        code_challenge_method?: string;
        response_type?: string;
        state?: string;
    }>;
}

export default async function AuthorizePage({ searchParams }: AuthorizePageProps) {
    const params = await searchParams;
    const { client_id, redirect_uri, code_challenge, code_challenge_method, response_type, state } = params;

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

    const client = await prisma.oAuthClient.findUnique({ where: { id: client_id } });

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

    // Server action: user approved the authorization request.
    async function handleAllow() {
        'use server';
        const rawCode = await generateAndStoreAuthCode({
            clientId: client_id!,
            userId: session!.user.id,
            redirectUri: redirect_uri!,
            codeChallenge: code_challenge!,
        });

        const callbackUrl = new URL(redirect_uri!);
        callbackUrl.searchParams.set('code', rawCode);
        if (state) callbackUrl.searchParams.set('state', state);
        redirect(callbackUrl.toString());
    }

    // Server action: user denied the authorization request.
    async function handleDeny() {
        'use server';
        const callbackUrl = new URL(redirect_uri!);
        callbackUrl.searchParams.set('error', 'access_denied');
        callbackUrl.searchParams.set('error_description', 'The user denied the authorization request.');
        if (state) callbackUrl.searchParams.set('state', state);
        redirect(callbackUrl.toString());
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
                <div className="mb-6 text-center">
                    <h1 className="text-xl font-semibold text-foreground">Authorization Request</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{client.name}</span> is requesting access to your Sourcebot account.
                    </p>
                </div>

                <div className="mb-6 rounded-md border border-border bg-muted p-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">This will allow {client.name} to:</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li>Search and read your repositories</li>
                        <li>Ask questions about your codebase</li>
                    </ul>
                </div>

                <div className="flex gap-3">
                    <form action={handleDeny} className="flex-1">
                        <button
                            type="submit"
                            className="w-full rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                        >
                            Deny
                        </button>
                    </form>
                    <form action={handleAllow} className="flex-1">
                        <button
                            type="submit"
                            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                            Allow
                        </button>
                    </form>
                </div>

                <p className="mt-4 text-center text-xs text-muted-foreground">
                    Logged in as <span className="font-medium">{session.user.email}</span>
                </p>
            </div>
        </div>
    );
}

function ErrorPage({ message }: { message: string }) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm text-center">
                <h1 className="text-xl font-semibold text-foreground mb-2">Authorization Error</h1>
                <p className="text-sm text-muted-foreground">{message}</p>
            </div>
        </div>
    );
}
