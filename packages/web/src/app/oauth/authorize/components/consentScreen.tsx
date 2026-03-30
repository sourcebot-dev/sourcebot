'use client';

import { approveAuthorization, denyAuthorization } from '@/ee/features/oauth/actions';
import { LoadingButton } from '@/components/ui/loading-button';
import { isServiceError } from '@/lib/utils';
import { ClientIcon } from './clientIcon';
import Image from 'next/image';
import logoDark from '@/public/sb_logo_dark_small.png';
import logoLight from '@/public/sb_logo_light_small.png';
import { useEffect, useState } from 'react';
import useCaptureEvent from '@/hooks/useCaptureEvent';
import { useToast } from '@/components/hooks/use-toast';

interface ConsentScreenProps {
    clientId: string;
    clientName: string;
    clientLogoUri: string | null;
    redirectUri: string;
    codeChallenge: string;
    resource: string | null;
    state: string | undefined;
    userEmail: string;
}

export function ConsentScreen({
    clientId,
    clientName,
    clientLogoUri,
    redirectUri,
    codeChallenge,
    resource,
    state,
    userEmail,
}: ConsentScreenProps) {
    const [pending, setPending] = useState<'approve' | 'deny' | null>(null);
    const captureEvent = useCaptureEvent();
    const { toast } = useToast();

    useEffect(() => {
        captureEvent('wa_oauth_consent_viewed', { clientId, clientName });
    }, [captureEvent, clientId, clientName]);

    const onApprove = async () => {
        captureEvent('wa_oauth_authorization_approved', { clientId, clientName });
        setPending('approve');
        const result = await approveAuthorization({ clientId, redirectUri, codeChallenge, resource, state });
        if (!isServiceError(result)) {
            toast({
                description: `✅ Authorization approved successfully. Redirecting...`,
            });
            window.location.href = result;
        } else {
            toast({
                description: `❌ Failed to approve authorization. ${result.message}`,
            });
        }
        setPending(null);
    };

    const onDeny = async () => {
        captureEvent('wa_oauth_authorization_denied', { clientId, clientName });
        setPending('deny');
        const result = await denyAuthorization({ redirectUri, state });
        if (isServiceError(result)) {
            setPending(null);
            return;
        }
        window.location.href = result;
    };

    return (
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">

            {/* App icons */}
            <div className="flex items-center justify-center gap-3 mb-6">
                <ClientIcon name={clientName} logoUri={clientLogoUri} />
                <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8m0 0-3-3m3 3-3 3M16 17H8m0 0 3 3m-3-3 3-3" />
                </svg>
                <Image
                    src={logoDark}
                    alt="Sourcebot"
                    width={70}
                    height={70}
                    className="shrink-0 rounded-xl object-cover hidden dark:block"
                />
                <Image
                    src={logoLight}
                    alt="Sourcebot"
                    width={70}
                    height={70}
                    className="shrink-0 rounded-xl object-cover block dark:hidden"
                />
            </div>

            {/* Title */}
            <h1 className="text-lg font-semibold text-foreground mb-2">
                <span className="font-bold">{clientName}</span> is requesting access to your Sourcebot account.
            </h1>
            <p className="text-sm text-muted-foreground text-center mb-6">
                Logged in as <span className="font-medium">{userEmail}</span>
            </p>

            {/* Details table */}
            <div className="mb-6 text-sm">
                <p className="text-muted-foreground mb-2">Details</p>
                <div className="rounded-md border border-border divide-y divide-border">
                    <div className="flex px-4 py-2.5">
                        <span className="font-medium text-foreground w-32 shrink-0">Name:</span>
                        <span>{clientName}</span>
                    </div>
                    <div className="flex px-4 py-2.5">
                        <span className="font-medium text-foreground w-32 shrink-0">Redirect URI:</span>
                        <span className="break-all">{redirectUri}</span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
                <LoadingButton
                    variant="outline"
                    onClick={onDeny}
                    loading={pending === 'deny'}
                    disabled={pending !== null}
                >
                    Cancel
                </LoadingButton>
                <LoadingButton
                    onClick={onApprove}
                    loading={pending === 'approve'}
                    disabled={pending !== null}
                >
                    Approve
                </LoadingButton>
            </div>

        </div>
    );
}
