'use client'
import { NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_POSTHOG_UI_HOST, NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED } from '@/lib/environment.client'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'

if (typeof window !== 'undefined') {
    if (!NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED) {
        posthog.init(NEXT_PUBLIC_POSTHOG_KEY!, {
            api_host: "/ingest",
            ui_host: NEXT_PUBLIC_POSTHOG_UI_HOST,
            person_profiles: 'identified_only',
            capture_pageview: false, // Disable automatic pageview capture, as we capture manually
        });
    } else {
        console.log("PostHog telemetry disabled");
    }
}

export function PHProvider({
    children,
}: {
    children: React.ReactNode
}) {
    return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}