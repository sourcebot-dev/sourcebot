import { NextResponse } from "next/server";
import { auth } from "./auth"

export default auth((request) => {
    const host = request.headers.get("host")!;

    const searchParams = request.nextUrl.searchParams.toString();
    const path = `${request.nextUrl.pathname}${
        searchParams.length > 0 ? `?${searchParams}` : ""
    }`;

    if (
        host === process.env.NEXT_PUBLIC_ROOT_DOMAIN ||
        host === 'localhost:3000'
    ) {
        if (request.nextUrl.pathname === "/login" && request.auth) {
            return NextResponse.redirect(new URL("/", request.url));
        }
        return NextResponse.next();
    }

    const subdomain = host.split(".")[0];
    return NextResponse.rewrite(new URL(`/${subdomain}${path}`, request.url));
});


export const config = {
    // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
    matcher: [
        /**
         * Match all paths except for:
         * 1. /api routes
         * 2. _next/ routes
         * 3. ingest (PostHog route)
         */
        '/((?!api|_next/static|ingest|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'
    ],
}