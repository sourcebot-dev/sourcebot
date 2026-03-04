import { auth } from '@/auth';
import { generateAndStoreAuthCode } from '@/features/oauth/server';
import { LogoutEscapeHatch } from '@/app/components/logoutEscapeHatch';
import { ClientIcon } from './components/clientIcon';
import { Button } from '@/components/ui/button';
import { prisma } from '@/prisma';
import { hasEntitlement } from '@sourcebot/shared';
import { redirect } from 'next/navigation';
import logo from '@/public/logo_512.png';
import Image from 'next/image';

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
    if (!hasEntitlement('oauth')) {
        return <ErrorPage message="OAuth authorization is not available on this plan." />;
    }

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
        const isWebUrl = callbackUrl.protocol === 'http:' || callbackUrl.protocol === 'https:';
        if (isWebUrl) {
            redirect(callbackUrl.toString());
        } else {
            redirect(`/oauth/complete?url=${encodeURIComponent(callbackUrl.toString())}`);
        }
    }

    // Server action: user denied the authorization request.
    async function handleDeny() {
        'use server';
        const callbackUrl = new URL(redirect_uri!);
        callbackUrl.searchParams.set('error', 'access_denied');
        callbackUrl.searchParams.set('error_description', 'The user denied the authorization request.');
        if (state) callbackUrl.searchParams.set('state', state);
        const isWebUrl = callbackUrl.protocol === 'http:' || callbackUrl.protocol === 'https:';
        if (isWebUrl) {
            redirect(callbackUrl.toString());
        } else {
            redirect(`/oauth/complete?url=${encodeURIComponent(callbackUrl.toString())}`);
        }
    }

    return (
        <div className="relative min-h-screen flex items-center justify-center bg-background">
            <LogoutEscapeHatch className="absolute top-0 right-0 p-6" />
            <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">

                {/* App icons */}
                <div className="flex items-center justify-center gap-3 mb-6">
                    <ClientIcon name={client.name} logoUri={client.logoUri} />
                    <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8m0 0-3-3m3 3-3 3M16 17H8m0 0 3 3m-3-3 3-3" />
                    </svg>
                    <Image
                        src={logo}
                        alt="Sourcebot"
                        width={70}
                        height={70}
                        className="shrink-0 rounded-xl object-cover"
                    />
                </div>

                {/* Title */}
                <h1 className="text-lg font-semibold text-foreground mb-2">
                    <span className="font-bold">{client.name}</span> is requesting access to your Sourcebot account.
                </h1>
                <p className="text-sm text-muted-foreground text-center mb-6">
                    Logged in as <span className="font-medium">{session.user.email}</span>
                </p>

                {/* Details table */}
                <div className="mb-6 text-sm">
                    <p className="text-muted-foreground mb-2">Details</p>
                    <div className="rounded-md border border-border divide-y divide-border">
                        <div className="flex px-4 py-2.5">
                            <span className="font-medium text-foreground w-32 shrink-0">Name:</span>
                            <span>{client.name}</span>
                        </div>
                        <div className="flex px-4 py-2.5">
                            <span className="font-medium text-foreground w-32 shrink-0">Redirect URI:</span>
                            <span className="break-all">{redirect_uri}</span>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3">
                    <form action={handleDeny}>
                        <Button type="submit" variant="outline">Cancel</Button>
                    </form>
                    <form action={handleAllow}>
                        <Button type="submit">Approve</Button>
                    </form>
                </div>

            </div>
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
