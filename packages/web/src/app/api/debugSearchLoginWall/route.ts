import { appendFileSync } from "node:fs";
import { z } from "zod";

const debugLogSchema = z.object({
    hypothesisId: z.string().max(20),
    location: z.string().max(100),
    message: z.string().max(100),
    data: z.object({
        showLoginWall: z.boolean().optional(),
        queryLength: z.number().int().nonnegative().optional(),
        loginDialogOpen: z.boolean().optional(),
        pathname: z.string().max(100).optional(),
        navigationType: z.string().max(30).optional(),
    }).strict(),
}).strict();

// eslint-disable-next-line authz/require-auth-wrapper -- temporary local-only debugging instrumentation
export const POST = async (request: Request) => {
    const parsed = debugLogSchema.safeParse(await request.json());
    if (!parsed.success) {
        return Response.json({ error: "Invalid debug log" }, { status: 400 });
    }

    // #region agent log
    appendFileSync("/opt/cursor/logs/debug.log", JSON.stringify({ ...parsed.data, timestamp: Date.now() }) + "\n");
    // #endregion
    return new Response(null, { status: 204 });
};
