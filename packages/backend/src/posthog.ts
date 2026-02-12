import { env, SOURCEBOT_VERSION } from "@sourcebot/shared";
import { PostHog } from 'posthog-node';
import { PosthogEvent, PosthogEventMap } from './posthogEvents.js';

let posthog: PostHog | undefined = undefined;

if (env.POSTHOG_PAPIK) {
    posthog = new PostHog(
        env.POSTHOG_PAPIK,
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
            sourcebot_version: SOURCEBOT_VERSION,
            install_id: env.SOURCEBOT_INSTALL_ID,
        },
    });
}

export async function shutdownPosthog() {
    await posthog?.shutdown();
}
