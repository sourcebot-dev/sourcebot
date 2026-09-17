import 'server-only';

import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { LogoutEscapeHatch } from '@/app/components/logoutEscapeHatch';
import { OPTIONAL_PROVIDERS_LINK_SKIPPED_COOKIE_NAME } from '@/lib/constants';
import { hasEntitlement } from '@/lib/entitlements';
import { ServiceErrorException } from '@/lib/serviceError';
import { isServiceError } from '@/lib/utils';
import { getLinkedAccounts } from '../actions';
import { hasRequiredUnlinkedProviders, hasUnlinkedProviders, hasUnskippedOptionalProviders, parseSkippedOptionalProviderIds } from '../utils';
import { ConnectAccountsCard } from './connectAccountsCard';

interface AccountLinkingGuardProps {
    children: ReactNode;
    callbackUrl: string;
}

// Controls the account-linking prompt before rendering the app or OAuth consent.
export async function AccountLinkingGuard({ children, callbackUrl }: AccountLinkingGuardProps) {
    if (!await auth() || !await hasEntitlement('sso')) {
        return children;
    }

    const linkedAccounts = await getLinkedAccounts();
    if (isServiceError(linkedAccounts)) {
        throw new ServiceErrorException(linkedAccounts);
    }

    if (!hasUnlinkedProviders(linkedAccounts)) {
        return children;
    }

    const cookieStore = await cookies();
    const skippedProviderIds = parseSkippedOptionalProviderIds(cookieStore.get(OPTIONAL_PROVIDERS_LINK_SKIPPED_COOKIE_NAME)?.value);
    if (!hasRequiredUnlinkedProviders(linkedAccounts) && !hasUnskippedOptionalProviders(linkedAccounts, skippedProviderIds)) {
        return children;
    }

    return (
        <div className="relative min-h-screen flex items-center justify-center bg-background p-6">
            <LogoutEscapeHatch className="absolute top-0 right-0 p-6" />
            <ConnectAccountsCard linkedAccounts={linkedAccounts} callbackUrl={callbackUrl} />
        </div>
    );
}
