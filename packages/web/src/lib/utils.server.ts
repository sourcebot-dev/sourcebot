import { env } from "@sourcebot/shared";

/**
 * Gets the base URL from Next.js headers, falling back to AUTH_URL environment variable
 * @param headersList The headers from Next.js headers() function
 * @returns The base URL (e.g., "https://example.com")
 */
export const getBaseUrl = (headersList: Headers): string => {
    const host = headersList.get('host');
    const protocol = headersList.get('x-forwarded-proto');
    
    // If we have both host and protocol from headers, use them
    if (host && protocol) {
        return `${protocol}://${host}`;
    }
    
    // Fall back to AUTH_URL environment variable
    return env.AUTH_URL;
}
