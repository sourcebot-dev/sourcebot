import { NextResponse } from "next/server";
import { auth } from "./auth"

/*
// We're not able to check if the user doesn't belong to any orgs in the middleware, since we cannot call prisma. As a result, we do this check
// in the root layout. However, there are certain endpoints (ex. login, redeem, onboard) that we want the user to be able to hit even if they don't
// belong to an org. It seems like the easiest way to do this is to check for these paths here and pass in a flag to the root layout using the headers
// https://github.com/vercel/next.js/discussions/43657#discussioncomment-5981981
const bypassOrgCheck = req.nextUrl.pathname === "/login" || req.nextUrl.pathname === "/redeem" || req.nextUrl.pathname.includes("onboard");
const bypassPaywall = req.nextUrl.pathname === "/login" || req.nextUrl.pathname === "/redeem" || req.nextUrl.pathname.includes("onboard") || req.nextUrl.pathname.includes("settings");
const requestheaders = new Headers(req.headers);
requestheaders.set("x-bypass-org-check", bypassOrgCheck.toString());
requestheaders.set("x-bypass-paywall", bypassPaywall.toString());
*/

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