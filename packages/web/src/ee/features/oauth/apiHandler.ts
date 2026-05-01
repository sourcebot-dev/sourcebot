import { apiHandler } from '@/lib/apiHandler';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (...args: any[]) => Promise<Response> | Response;

/**
 * Wraps `apiHandler` for routes that are part of the OAuth Authorization Server
 * (`/api/ee/oauth/*`).
 *
 * Per RFC 9700 §4.12, the authorization server MUST avoid forwarding user
 * credentials accidentally on redirect. 307 and 308 preserve the request
 * method and body, so they MUST NOT be used for authorization-server
 * redirects. This wrapper asserts that handlers never emit either status,
 * giving us a runtime guarantee.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc9700#section-4.12
 */
export function oauthApiHandler<H extends AnyHandler>(handler: H): H {
    const wrapped = apiHandler(async (...args: Parameters<H>) => {
        const response = await handler(...args);
        if (response.status === 307 || response.status === 308) {
            throw new Error(
                `OAuth authorization server emitted HTTP ${response.status} redirect; ` +
                `per RFC 9700 §4.12 the authorization server MUST NOT use 307/308. ` +
                `Use 303 (See Other) instead.`
            );
        }
        return response;
    });

    return wrapped as H;
}
