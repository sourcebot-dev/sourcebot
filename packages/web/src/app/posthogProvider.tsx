'use client'
import { NEXT_PUBLIC_POSTHOG_PAPIK, NEXT_PUBLIC_POSTHOG_UI_HOST, NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED } from '@/lib/environment.client'
import posthog from 'posthog-js'
import { usePostHog } from 'posthog-js/react'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { resolveServerPath } from './api/(client)/client'
import { isDefined } from '@/lib/utils'
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, Suspense } from "react"

const POSTHOG_ENABLED = isDefined(NEXT_PUBLIC_POSTHOG_PAPIK) && !NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED;

function PostHogPageView() {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const posthog = usePostHog()

    // Track pageviews
    useEffect(() => {
        if (pathname && posthog) {
            let url = window.origin + pathname
            if (searchParams.toString()) {
                url = url + `?${searchParams.toString()}`
            }

            posthog.capture('$pageview', { '$current_url': url })
        }
    }, [pathname, searchParams, posthog])

    return null
}

export default function SuspendedPostHogPageView() {
    return <Suspense fallback={null}>
        <PostHogPageView />
    </Suspense>
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        if (POSTHOG_ENABLED) {
            // @see next.config.mjs for path rewrites to the "/ingest" route.
            const posthogHostPath = resolveServerPath('/ingest');
    
            posthog.init(NEXT_PUBLIC_POSTHOG_PAPIK!, {
                api_host: posthogHostPath,
                ui_host: NEXT_PUBLIC_POSTHOG_UI_HOST,
                capture_pageview: false, // Disable automatic pageview capture
                autocapture: false, // Disable automatic event capture
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                /* @nocheckin HANDLE SELF HOSTED CASE
                person_profiles: 'identified_only',
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
                */
            });
        } else {
            console.log("PostHog telemetry disabled");
        }
    }, [])

    return (
        <PHProvider client={posthog}>
            <PostHogPageView />
            {children}
        </PHProvider>
    )
}