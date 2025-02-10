
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
    // if we're trying to redeem an invite while not authed we continue to the redeem page so
    // that we can pipe the invite_id to the login page
    if (!req.auth && req.nextUrl.pathname === "/redeem") {
        return NextResponse.next();
    }

    if (!req.auth && req.nextUrl.pathname !== "/login") {
        const newUrl = new URL("/login", req.nextUrl.origin);
        return NextResponse.redirect(newUrl);
    } else if (req.auth && req.nextUrl.pathname === "/login") {
        const newUrl = new URL("/", req.nextUrl.origin);
        return NextResponse.redirect(newUrl);
    }

    return NextResponse.next();
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