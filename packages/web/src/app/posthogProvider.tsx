'use client'
import posthog from 'posthog-js'
import { usePostHog } from 'posthog-js/react'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { usePathname, useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"
import { env } from '@/env.mjs'
import { useSession } from 'next-auth/react'
import { captureEvent } from '@/hooks/useCaptureEvent'

// @see: https://posthog.com/docs/libraries/next-js#capturing-pageviews
function PostHogPageView() {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const posthog = usePostHog()

    useEffect(() => {
        if (pathname && posthog) {
            let url = window.origin + pathname
            if (searchParams.toString()) {
                url = url + `?${searchParams.toString()}`
            }

            captureEvent('$pageview', {
                $current_url: url,
            });
        }
    }, [pathname, searchParams, posthog])

    return null
}

interface PostHogProviderProps {
    children: React.ReactNode
    disabled: boolean
}

export function PostHogProvider({ children, disabled }: PostHogProviderProps) {
    const { data: session } = useSession();

    useEffect(() => {
        if (!disabled && env.NEXT_PUBLIC_POSTHOG_PAPIK) {
            console.debug(`PostHog telemetry enabled. Cloud environment: ${env.NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT}`);
            posthog.init(env.NEXT_PUBLIC_POSTHOG_PAPIK, {
                // @see next.config.mjs for path rewrites to the "/ingest" route.
                api_host: "/ingest",
                person_profiles: 'identified_only',
                capture_pageview: false,
                autocapture: false,
                // In self-hosted mode, we don't want to capture the following
                // default properties.
                // @see: https://posthog.com/docs/data/events#default-properties
                property_denylist: env.NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT === undefined ? [
                    '$current_url',
                    '$pathname',
                    '$session_entry_url',
                    '$session_entry_host',
                    '$session_entry_pathname',
                    '$session_entry_referrer',
                    '$session_entry_referring_domain',
                    '$referrer',
                    '$referring_domain',
                    '$ip',
                ] : []
            });
        } else {
            console.debug("PostHog telemetry disabled");
        }
    }, [disabled]);

    useEffect(() => {
        if (!session) {
            return;
        }

        // Only identify the user if we are running in a cloud environment.
        if (env.NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT !== undefined) {
            posthog.identify(session.user.id, {
                email: session.user.email,
                name: session.user.name,
            });
        } else {
            console.debug("PostHog identify skipped");
        }
    }, [session]);

    return (
        <PHProvider client={posthog}>
            {/* @see: https://github.com/vercel/next.js/issues/51581 */}
            <Suspense fallback={null}>
                <PostHogPageView />
            </Suspense>
            {children}
        </PHProvider>
    )
}