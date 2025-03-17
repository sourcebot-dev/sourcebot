'use client';

import { CaptureOptions } from "posthog-js";
import posthog from "posthog-js";
import { PosthogEvent, PosthogEventMap } from "../lib/posthogEvents";
import { env } from "@/env.mjs";

export function captureEvent<E extends PosthogEvent>(event: E, properties: PosthogEventMap[E], options?: CaptureOptions) {
    if(!options) {
        options = {};
    }
    options.send_instantly = true;
    posthog.capture(event, {
        ...properties,
        sourcebot_version: env.NEXT_PUBLIC_SOURCEBOT_VERSION,
    }, options);
}

/**
 * Captures a distinct action as a event and forwards it to the event service
 * (i.e., PostHog).
 *
 * @returns A callback for capturing events.
 * @see: https://posthog.com/docs/libraries/js#capturing-events
 */
const useCaptureEvent = () => {
    return captureEvent;
}

export default useCaptureEvent;