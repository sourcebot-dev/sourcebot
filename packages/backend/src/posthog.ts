import { PostHog } from 'posthog-node';
import { PosthogEvent, PosthogEventMap } from './posthogEvents.js';
import { env } from './env.js';

let posthog: PostHog | undefined = undefined;

if (env.NEXT_PUBLIC_POSTHOG_PAPIK) {
    posthog = new PostHog(
        env.NEXT_PUBLIC_POSTHOG_PAPIK,
        {
            host: "https://us.i.posthog.com",
        }
    );
}

export function captureEvent<E extends PosthogEvent>(event: E, properties: PosthogEventMap[E]) {
    if (env.SOURCEBOT_TELEMETRY_DISABLED === 'true') {
        return;
    }

    posthog?.capture({
        distinctId: env.SOURCEBOT_INSTALL_ID,
        event: event,
        properties: {
            ...properties,
            sourcebot_version: env.NEXT_PUBLIC_SOURCEBOT_VERSION,
        },
    });
}

await posthog?.shutdown();