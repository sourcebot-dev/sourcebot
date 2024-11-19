'use client'
import { NEXT_PUBLIC_POSTHOG_PAPIK, NEXT_PUBLIC_POSTHOG_UI_HOST, NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED } from '@/lib/environment.client'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { resolveServerPath } from './api/(client)/client'
import { isDefined } from '@/lib/utils'

if (typeof window !== 'undefined') {
    if (!NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED && isDefined(NEXT_PUBLIC_POSTHOG_PAPIK)) {
        // @see next.config.mjs for path rewrites to the "/ingest" route.
        const posthogHostPath = resolveServerPath('/ingest');

        posthog.init(NEXT_PUBLIC_POSTHOG_PAPIK, {
            api_host: posthogHostPath,
            ui_host: NEXT_PUBLIC_POSTHOG_UI_HOST,
            person_profiles: 'identified_only',
            capture_pageview: false, // Disable automatic pageview capture
            autocapture: false, // Disable automatic event capture
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sanitize_properties: (properties: Record<string, any>, _event: string) => {
                // https://posthog.com/docs/libraries/js#config
                if (properties['$current_url']) {
                    properties['$current_url'] = null;
                }
                if (properties['$ip']) {
                    properties['$ip'] = null;
                }
            
                return properties;
            }
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