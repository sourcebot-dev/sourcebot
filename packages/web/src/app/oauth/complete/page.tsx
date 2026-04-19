'use client';

import { useEffect, useState } from 'react';
import { UNPERMITTED_SCHEMES } from '@/ee/features/oauth/constants';

// Handles the final redirect after OAuth authorization. For http/https redirect URIs,
// a server-side redirect is sufficient. For custom protocol URIs (e.g. cursor://, claude://),
// browsers won't follow HTTP redirects, so we use window.location.href instead.
export default function OAuthCompletePage() {
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const raw = new URLSearchParams(window.location.search).get('url');
        if (!raw) {
            setError('Missing redirect URL. You may close this window.');
            return;
        }
        const decoded = decodeURIComponent(raw);
        if (UNPERMITTED_SCHEMES.test(decoded)) {
            setError('Redirect URL is not permitted. You may close this window.');
            return;
        }
        window.location.href = decoded;
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <p className="text-sm text-muted-foreground">
                {error ?? 'Redirecting, you may close this window...'}
            </p>
        </div>
    );
}
