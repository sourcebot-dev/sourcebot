import { PostHog } from 'posthog-node'
import { createLogger, env, SOURCEBOT_VERSION } from '@sourcebot/shared'
import { RequestCookies } from 'next/dist/compiled/@edge-runtime/cookies';
import * as Sentry from "@sentry/nextjs";
import { PosthogEvent, PosthogEventMap } from './posthogEvents';
import { cookies, headers } from 'next/headers';
import { getAuthenticatedUser } from '@/middleware/withAuth';

const logger = createLogger('posthog');

/**
 * @note: This is a subset of the properties stored in the
 * ph_phc_<id>_posthog cookie.
 */
export type PostHogCookie = {
    distinct_id: string;
    $user_state?: 'anonymous' | 'identified';
}

const isPostHogCookie = (cookie: unknown): cookie is PostHogCookie => {
    return typeof cookie === 'object' &&
        cookie !== null &&
        'distinct_id' in cookie;
}

/**
* Attempts to retrieve the PostHog cookie from the given cookie store, returning
* undefined if the cookie is not found or is invalid.
*/
const getPostHogCookie = (cookieStore: Pick<RequestCookies, 'get'>): PostHogCookie | undefined => {
    const phCookieKey = `ph_${env.POSTHOG_PAPIK}_posthog`;
    const cookie = cookieStore.get(phCookieKey);

    if (!cookie) {
        return undefined;
    }

    const parsedCookie = (() => {
        try {
            return JSON.parse(cookie.value);
        } catch (e) {
            Sentry.captureException(e);
            return null;
        }
    })();

    if (isPostHogCookie(parsedCookie)) {
        return parsedCookie;
    }

    return undefined;
}

/**
 * Attempts to retrieve the distinct id of the current user, along with whether
 * that id corresponds to an *identified* user (as opposed to an anonymous one).
 */
export const tryGetPostHogDistinctId = async (): Promise<{
    distinctId: string | undefined;
    isIdentified: boolean;
}> => {
    // First, attempt to retrieve the distinct id from the PostHog cookie
    // (set by the client-side PostHog SDK). This preserves identity
    // continuity between client-side and server-side events.
    const cookieStore = await cookies();
    const cookie = getPostHogCookie(cookieStore);
    if (cookie) {
        return {
            distinctId: cookie.distinct_id,
            isIdentified: cookie.$user_state === 'identified',
        };
    }

    // Fall back to the authenticated user's ID. This covers all auth
    // methods: session cookies, OAuth Bearer tokens, and API keys.
    const authResult = await getAuthenticatedUser();
    if (authResult?.user.id) {
        return { distinctId: authResult.user.id, isIdentified: true };
    }

    return { distinctId: undefined, isIdentified: false };
}

export const createPostHogClient = async () => {
    const posthog = new PostHog(env.POSTHOG_PAPIK, {
        host: 'https://us.i.posthog.com',
        flushAt: 1,
        flushInterval: 0
    });

    return posthog;
}

export async function captureEvent<E extends PosthogEvent>(event: E, properties: PosthogEventMap[E]) {
    try {
        if (env.SOURCEBOT_TELEMETRY_DISABLED === 'true') {
            return;
        }

        const { distinctId, isIdentified } = await tryGetPostHogDistinctId();
        const posthog = await createPostHogClient();

        const headersList = await headers();
        const host = headersList.get("host") ?? undefined;

        posthog.capture({
            event,
            properties: {
                ...properties,
                sourcebot_version: SOURCEBOT_VERSION,
                install_id: env.SOURCEBOT_INSTALL_ID,
                $host: host,
                // Mirror the client's `identified_only` setting: only identified
                // users get a person profile. Anonymous requests (logged-out
                // visitors and unauthenticated API calls) are sent as personless
                // events so we don't create a person profile per request and
                // inflate person counts/billing.
                // @see: https://posthog.com/handbook/engineering/person-processing#personless-mode-anonymous-events
                ...(isIdentified ? {} : { $process_person_profile: false }),
            },
            // @note: Key anonymous events to the install id so they
            // collapse to a single identity instead of a brand-new one
            // on every call.
            distinctId: distinctId ?? env.SOURCEBOT_INSTALL_ID,
            groups: { company: env.SOURCEBOT_INSTALL_ID },
        });
    } catch (error) {
        logger.error('Failed to capture PostHog event:', error);
    }
}