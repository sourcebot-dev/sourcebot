import { PostHog } from 'posthog-node'
import { env, SOURCEBOT_VERSION } from '@sourcebot/shared'
import { RequestCookies } from 'next/dist/compiled/@edge-runtime/cookies';
import * as Sentry from "@sentry/nextjs";
import { PosthogEvent, PosthogEventMap } from './posthogEvents';
import { cookies, headers } from 'next/headers';
import { auth } from '@/auth';
import { getVerifiedApiObject } from '@/withAuthV2';

/**
 * @note: This is a subset of the properties stored in the
 * ph_phc_<id>_posthog cookie.
 */
export type PostHogCookie = {
    distinct_id: string;
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
 * Attempts to retrieve the distinct id of the current user.
 */
const tryGetDistinctId = async () => {
    // First, attempt to retrieve the distinct id from the cookie.
    const cookieStore = await cookies();
    const cookie = getPostHogCookie(cookieStore);
    if (cookie) {
        return cookie.distinct_id;
    }

    // Next, from the session.
    const session = await auth();
    if (session) {
        return session.user.id;
    }

    // Finally, from the api key.
    const headersList = await headers();
    const apiKeyString = headersList.get("X-Sourcebot-Api-Key") ?? undefined;
    if (!apiKeyString) {
        return undefined;
    }

    const apiKey = await getVerifiedApiObject(apiKeyString);
    return apiKey?.createdById;
}

export async function captureEvent<E extends PosthogEvent>(event: E, properties: PosthogEventMap[E]) {
    if (env.SOURCEBOT_TELEMETRY_DISABLED === 'true') {
        return;
    }

    const distinctId = await tryGetDistinctId();

    const headersList = await headers();
    const host = headersList.get("host") ?? undefined;

    const posthog = new PostHog(env.POSTHOG_PAPIK, {
        host: 'https://us.i.posthog.com',
        flushAt: 1,
        flushInterval: 0
    })

    posthog.capture({
        event,
        properties: {
            ...properties,
            sourcebot_version: SOURCEBOT_VERSION,
            install_id: env.SOURCEBOT_INSTALL_ID,
            $host: host,
        },
        distinctId,
    });
}