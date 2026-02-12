'use client'
import posthog from 'posthog-js'
import { usePostHog } from 'posthog-js/react'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { usePathname, useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"
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
    isDisabled: boolean
    isPiiEnabled: boolean
    posthogApiKey: string
    sourcebotVersion: string
    sourcebotInstallId: string
}

export function PostHogProvider({
    children,
    isDisabled,
    isPiiEnabled,
    posthogApiKey,
    sourcebotVersion,
    sourcebotInstallId,
}: PostHogProviderProps) {
    const { data: session } = useSession();

    useEffect(() => {
        if (!isDisabled) {
            posthog.init(posthogApiKey, {
                // @see next.config.mjs for path rewrites to the "/ingest" route.
                api_host: "/ingest",
                person_profiles: 'identified_only',
                capture_pageview: false,
                autocapture: false,
                // If PII is not enabled, we don't want to capture the following
                // default properties that may contain PII.
                // @see: https://posthog.com/docs/data/events#default-properties
                property_denylist: isPiiEnabled === false ? [
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
                ] : [],
                loaded: (posthog) => {
                    // Include install id & version in all events.
                    posthog.register({
                        sourcebot_version: sourcebotVersion,
                        install_id: sourcebotInstallId,
                    });
                }
            });
        } else {
            console.debug("PostHog telemetry disabled");
        }
    }, [isDisabled, isPiiEnabled, posthogApiKey, sourcebotInstallId, sourcebotVersion]);

    useEffect(() => {
        if (!session) {
            return;
        }

        posthog.identify(
            session.user.id,
            isPiiEnabled === true ? {
                email: session.user.email,
                name: session.user.name,
            } : undefined
        );
    }, [isPiiEnabled, session]);

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