'use client'
import posthog from 'posthog-js'
import { usePostHog } from 'posthog-js/react'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { usePathname, useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"
import { env } from '@/env.mjs'

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

interface PostHogProviderProps {
    children: React.ReactNode
    disabled: boolean
}

export function PostHogProvider({ children, disabled }: PostHogProviderProps) {
    useEffect(() => {
        if (!disabled && env.NEXT_PUBLIC_POSTHOG_PAPIK) {
            posthog.init(env.NEXT_PUBLIC_POSTHOG_PAPIK, {
                // @see next.config.mjs for path rewrites to the "/ingest" route.
                api_host: "/ingest",
                ui_host: env.NEXT_PUBLIC_POSTHOG_UI_HOST,
                person_profiles: 'identified_only',
                capture_pageview: false, // @nocheckin Disable automatic pageview capture if we're not in public demo mode
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
    }, [disabled])

    return (
        <PHProvider client={posthog}>
            <Suspense fallback={null}>
                <PostHogPageView />
            </Suspense>
            {children}
        </PHProvider>
    )
}