
import { auth } from "@/auth";
import { Session } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { notAuthenticated, serviceErrorResponse } from "./lib/serviceError";

interface NextAuthRequest extends NextRequest {
    auth: Session | null;
  }

const apiMiddleware = (req: NextAuthRequest) => {
    if (req.nextUrl.pathname.startsWith("/api/auth")) {
        return NextResponse.next();
    }

    if (!req.auth) {
        return serviceErrorResponse(
            notAuthenticated(),
        );
    }

    return NextResponse.next();
}

const defaultMiddleware = (req: NextAuthRequest) => {
    // We're not able to check if the user doesn't belong to any orgs in the middleware, since we cannot call prisma. As a result, we do this check
    // in the root layout. However, there are certain endpoints (ex. login, redeem, onboard) that we want the user to be able to hit even if they don't
    // belong to an org. It seems like the easiest way to do this is to check for these paths here and pass in a flag to the root layout using the headers
    // https://github.com/vercel/next.js/discussions/43657#discussioncomment-5981981
    const bypassOrgCheck = req.nextUrl.pathname === "/login" || req.nextUrl.pathname === "/redeem" || req.nextUrl.pathname.includes("onboard");
    const requestheaders = new Headers(req.headers);
    requestheaders.set("x-bypass-org-check", bypassOrgCheck.toString());

    // if we're trying to redeem an invite while not authed we continue to the redeem page so
    // that we can pipe the invite_id to the login page
    if (!req.auth && req.nextUrl.pathname === "/redeem") {
        return NextResponse.next({
            request: {
                headers: requestheaders,
            }
        });
    }

    if (!req.auth && req.nextUrl.pathname !== "/login") {
        const newUrl = new URL("/login", req.nextUrl.origin);
        return NextResponse.redirect(newUrl);
    } else if (req.auth && req.nextUrl.pathname === "/login") {
        const newUrl = new URL("/", req.nextUrl.origin);
        return NextResponse.redirect(newUrl);
    }

    return NextResponse.next({
        request: {
            headers: requestheaders,
        }
    });
}

export default auth(async (req) => {
    if (req.nextUrl.pathname.startsWith("/api")) {
        return apiMiddleware(req); 
    }

    return defaultMiddleware(req);
})


export const config = {
    // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
    matcher: ['/((?!_next/static|ingest|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
}