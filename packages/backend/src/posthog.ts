import { env as clientEnv } from "@sourcebot/shared/client";
import { env } from "@sourcebot/shared";
import { PostHog } from 'posthog-node';
import { PosthogEvent, PosthogEventMap } from './posthogEvents.js';

let posthog: PostHog | undefined = undefined;

if (clientEnv.NEXT_PUBLIC_POSTHOG_PAPIK) {
    posthog = new PostHog(
        clientEnv.NEXT_PUBLIC_POSTHOG_PAPIK,
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
            sourcebot_version: clientEnv.NEXT_PUBLIC_SOURCEBOT_VERSION,
        },
    });
}

export async function shutdownPosthog() {
    await posthog?.shutdown();
}
