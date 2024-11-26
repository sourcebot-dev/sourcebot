import { PostHog } from 'posthog-node';
import { PosthogEvent, PosthogEventMap } from './posthogEvents.js';
import { POSTHOG_HOST, POSTHOG_PAPIK, SOURCEBOT_INSTALL_ID, SOURCEBOT_TELEMETRY_DISABLED, SOURCEBOT_VERSION } from './environment.js';

let posthog: PostHog | undefined = undefined;

if (POSTHOG_PAPIK) {
    posthog = new PostHog(
        POSTHOG_PAPIK,
        {
            host: POSTHOG_HOST,
        }
    );
}

export function captureEvent<E extends PosthogEvent>(event: E, properties: PosthogEventMap[E]) {
    if (SOURCEBOT_TELEMETRY_DISABLED) {
        return;
    }

    posthog?.capture({
        distinctId: SOURCEBOT_INSTALL_ID,
        event: event,
        properties: {
            ...properties,
            sourcebot_version: SOURCEBOT_VERSION,
        },
    });
}

await posthog?.shutdown();