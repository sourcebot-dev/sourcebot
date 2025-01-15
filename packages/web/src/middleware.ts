
export {
    auth as middleware
} from "@/auth";

export const config = {
    // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
    matcher: ['/((?!api|_next/static|_next/image|.*\\.png$|favicon.ico|sitemap.xml|robots.txt).*)'],
}