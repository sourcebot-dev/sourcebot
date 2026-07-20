'use client';

import { setSentryUser } from '@/lib/sentryUser';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

interface SentryUserProviderProps {
    isPiiEnabled: boolean;
}

export function SentryUserProvider({ isPiiEnabled }: SentryUserProviderProps) {
    const { data: session, status } = useSession();

    useEffect(() => {
        if (status === 'loading') {
            return;
        }

        setSentryUser(session?.user ?? null, isPiiEnabled);
    }, [isPiiEnabled, session, status]);

    return null;
}
