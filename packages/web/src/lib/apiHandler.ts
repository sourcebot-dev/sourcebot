import { NextRequest } from 'next/server';
import { captureEvent } from './posthog';

interface ApiHandlerConfig {
    /**
     * Whether to track this API request in PostHog.
     * @default true
     */
    track?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (...args: any[]) => Promise<Response> | Response;

/**
 * Creates an API route handler with automatic request tracking.
 *
 * @example
 * // Simple handler
 * export const GET = apiHandler(async (request) => {
 *     return Response.json({ data: 'hello' });
 * });
 *
 * @example
 * // Handler with route params
 * export const GET = apiHandler(async (request, { params }) => {
 *     const { id } = await params;
 *     return Response.json({ id });
 * });
 *
 * @example
 * // Disable tracking (for health checks, etc.)
 * export const GET = apiHandler(async () => {
 *     return Response.json({ status: 'ok' });
 * }, { track: false });
 */
export function apiHandler<H extends AnyHandler>(
    handler: H,
    config: ApiHandlerConfig = {}
): H {
    const { track = true } = config;

    const wrappedHandler = async (request: NextRequest, ...rest: unknown[]) => {
        if (track) {
            const path = request.nextUrl.pathname;
            const source = request.headers.get('X-Sourcebot-Client-Source') ?? 'unknown';

            // Fire and forget - don't await to avoid blocking the request
            captureEvent('api_request', { path, source }).catch(() => {
                // Silently ignore tracking errors
            });
        }

        // Call the original handler with all arguments
        return handler(request, ...rest);
    };

    return wrappedHandler as H;
}
