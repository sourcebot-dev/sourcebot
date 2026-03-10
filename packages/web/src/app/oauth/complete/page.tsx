'use client';

import { useEffect } from 'react';

// Handles the final redirect after OAuth authorization. For http/https redirect URIs,
// a server-side redirect is sufficient. For custom protocol URIs (e.g. cursor://, claude://),
// browsers won't follow HTTP redirects, so we use window.location.href instead.
export default function OAuthCompletePage() {
    useEffect(() => {
        const url = new URLSearchParams(window.location.search).get('url');
        if (url) {
            window.location.href = decodeURIComponent(url);
        }
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <p className="text-sm text-muted-foreground">Redirecting, you may close this window...</p>
        </div>
    );
}
