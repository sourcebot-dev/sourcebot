import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * As part of our original SaaS effort in April 2025, we introduced
 * multi-tenancy into Sourcebot as part of v3.0.0. Organizations
 * (or tenants) were assigned a domain suffix that would be appended
 * as the root part of the URL (e.g., `https://sourcebot.dev/org-a/...`)
 * allowing us to identify what the current organization context was.
 * For self-hosted instances, multi-tenancy was irrelevant, and so the
 * domain suffix was simple `~` for the single-tenant org.
 * 
 * In v4.0.0, we scrapped multi-tenancy, but we were left with the
 * `~` in the URL pathname. In v4.16.8, we removed the org domain
 * prefix from the URL pathname and shifted all routes to be served
 * at the root domain.
 * 
 * The following proxy middleware is used to redirect URLs that were
 * created between v3.0.0 and v4.16.8 to the new canonical URL structure.
 * For example, `https://sourcebot.dev/~/invite/123` would be redirected
 * to `https://sourcebot.dev/invite/123`.
 * 
 * See: https://github.com/sourcebot-dev/sourcebot/pull/1076
 */
export async function proxy(request: NextRequest) {
    const url = request.nextUrl.clone();

    if (url.pathname.startsWith('/~/')) {
        url.pathname = url.pathname.replace(/^\/~/, '');
        return NextResponse.redirect(url, 308);
    }

    if (url.pathname === '/~') {
        url.pathname = '/';
        return NextResponse.redirect(url, 308);
    }

    return NextResponse.next();
}
