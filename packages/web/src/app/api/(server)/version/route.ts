import { env } from "@sourcebot/shared/client";
import { GetVersionResponse } from "@/lib/types";

// Note: In Next.JS 14, GET methods with no params are cached by default at build time.
// This creates issues since environment variables (like SOURCEBOT_VERSION) are
// not available until runtime. To work around this, we fore the route to be
// dynamic and evaluate on each request.
// @see: https://nextjs.org/docs/14/app/building-your-application/routing/route-handlers#caching
export const dynamic = "force-dynamic";

export const GET = async () => {
    return Response.json({
        version: env.NEXT_PUBLIC_SOURCEBOT_VERSION,
    } satisfies GetVersionResponse);
}