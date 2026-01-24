import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SINGLE_TENANT_ORG_DOMAIN } from '@/lib/constants'

export async function middleware(request: NextRequest) {
    const url = request.nextUrl.clone();

    if (
        url.pathname.startsWith('/login') ||
        url.pathname.startsWith('/redeem') ||
        url.pathname.startsWith('/signup') ||
        url.pathname.startsWith('/invite') ||
        url.pathname.startsWith('/onboard')
    ) {
        return NextResponse.next();
    }

    const pathSegments = url.pathname.split('/').filter(Boolean);
    const currentDomain = pathSegments[0];

    // If we're already on the correct domain path, allow
    if (currentDomain === SINGLE_TENANT_ORG_DOMAIN) {
        return NextResponse.next();
    }

    url.pathname = `/${SINGLE_TENANT_ORG_DOMAIN}${pathSegments.length > 1 ? '/' + pathSegments.slice(1).join('/') : ''}`;
    return NextResponse.redirect(url);
}

export const config = {
    // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
    matcher: [
        '/((?!api|_next/static|ingest|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.json|logo_192.png|logo_512.png|sb_logo_light_large.png|arrow.png|placeholder_avatar.png|sb_logo_dark_small.png|sb_logo_light_small.png).*)',
    ],
}