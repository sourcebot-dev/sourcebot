import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { env } from './env.mjs'
import { SINGLE_TENANT_ORG_DOMAIN } from '@/lib/constants'

export async function middleware(request: NextRequest) {
    const url = request.nextUrl.clone();

    // Check for GCP IAP headers and auto sign-in if present
    if (env.AUTH_EE_GCP_IAP_ENABLED === 'true' && env.AUTH_EE_GCP_IAP_AUDIENCE) {
        const iapAssertion = request.headers.get('x-goog-iap-jwt-assertion');
        const sessionToken = request.cookies.get('next-auth.session-token') || request.cookies.get('__Secure-next-auth.session-token');
        
        // If IAP header exists but no session, auto sign-in
        if (iapAssertion && !sessionToken && !url.pathname.startsWith('/api/auth')) {
            try {
                // Make server-side request to NextAuth gcp-iap credentials endpoint
                const signInResponse = await fetch(new URL('/api/auth/signin/gcp-iap', request.url), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'x-goog-iap-jwt-assertion': iapAssertion,
                        'X-Forwarded-For': request.headers.get('x-forwarded-for') || request.ip || '',
                        'User-Agent': request.headers.get('user-agent') || '',
                    },
                    body: new URLSearchParams({
                        callbackUrl: request.url,
                        json: 'true'
                    })
                });

                if (signInResponse.ok) {
                    const result = await signInResponse.json();
                    
                    // If sign-in was successful and we got a redirect URL
                    if (result.url) {
                        const response = NextResponse.redirect(result.url);
                        
                        // Copy any Set-Cookie headers from the sign-in response
                        const setCookieHeader = signInResponse.headers.get('set-cookie');
                        if (setCookieHeader) {
                            response.headers.set('set-cookie', setCookieHeader);
                        }
                        
                        return response;
                    }
                }
            } catch (error) {
                console.error('Failed to auto sign-in with GCP IAP:', error);
                // Fall through to normal flow if auto sign-in fails
            }
        }
    }

    if (env.SOURCEBOT_TENANCY_MODE !== 'single') {
        return NextResponse.next();
    }

    if (url.pathname.startsWith('/login') || url.pathname.startsWith('/redeem')) {
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
        '/((?!api|_next/static|ingest|_next/image|favicon.ico|sitemap.xml|robots.txt|sb_logo_light_large.png|arrow.png|placeholder_avatar.png).*)',
    ],
}
